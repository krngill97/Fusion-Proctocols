// ===========================================
// Fusion - Volume Bot Service
// ===========================================

import { Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import VolumeSession from './volume.model.js';
import User from '../auth/auth.model.js';
import Settings from '../settings/settings.model.js';
import { getHttpConnection } from '../../config/chainstack.js';
import { wsEvents } from '../../websocket/index.js';
import { logger } from '../../shared/utils/logger.js';
import { solToLamports, lamportsToSol, sleep, generateRandomAmount } from '../../shared/utils/helpers.js';
import { cache } from '../../config/redis.js';

const log = logger.withContext('VolumeBot');

// ------------------------------------
// Active Sessions State
// ------------------------------------

let activeSessions = new Map(); // Map<sessionId, { session, interval, wallets }>

// ------------------------------------
// Create Session
// ------------------------------------

/**
 * Create a new volume bot session
 * @param {Object} params - Session parameters
 * @returns {Promise<Object>} Created session
 */
export const createSession = async ({
  userId,
  tokenMint,
  depositAmount,
  config = {}
}) => {
  try {
    // Get settings
    const settings = await Settings.getSettings();
    const volumeSettings = settings.volumeBot;

    if (!volumeSettings.enabled) {
      throw new Error('Volume bot is disabled');
    }

    // Check user's active sessions
    const userActiveSessions = await VolumeSession.countDocuments({
      userId,
      status: { $in: ['pending', 'running', 'paused'] }
    });

    if (userActiveSessions >= volumeSettings.maxSessionsPerUser) {
      throw new Error(`Maximum ${volumeSettings.maxSessionsPerUser} active session(s) allowed`);
    }

    // Validate deposit amount
    if (depositAmount > volumeSettings.maxDepositSol) {
      throw new Error(`Maximum deposit is ${volumeSettings.maxDepositSol} SOL`);
    }

    if (depositAmount < 0.1) {
      throw new Error('Minimum deposit is 0.1 SOL');
    }

    // Generate funding wallet
    const fundingKeypair = Keypair.generate();
    const { encrypt } = await import('../../shared/services/encryption.service.js');
    const user = await User.findById(userId);

    const fundingWallet = {
      publicKey: fundingKeypair.publicKey.toBase58(),
      encryptedPrivateKey: encrypt(Buffer.from(fundingKeypair.secretKey).toString('hex'), user.walletAddress)
    };

    // Generate maker/generated wallets
    const walletCount = config.walletCount || 5;
    const generatedWallets = [];

    for (let i = 0; i < walletCount; i++) {
      const keypair = Keypair.generate();
      generatedWallets.push({
        publicKey: keypair.publicKey.toBase58(),
        encryptedPrivateKey: encrypt(Buffer.from(keypair.secretKey).toString('hex'), user.walletAddress),
        solBalance: 0,
        tokenBalance: 0,
        transactionCount: 0,
        lastActivity: null
      });
    }

    // Convert maxDuration from milliseconds to minutes if needed
    const durationMinutes = config.maxDuration
      ? Math.floor(config.maxDuration / 60000)
      : 60; // Default 1 hour

    // Create session matching the model schema
    const session = await VolumeSession.create({
      userId,
      tokenMint,
      network: volumeSettings.defaultNetwork || 'devnet',
      fundingWallet,
      generatedWallets,
      config: {
        totalSolDeposited: depositAmount,
        duration: durationMinutes,
        walletCount: walletCount,
        txFrequency: config.txFrequency || 10,
        minAmount: config.minTradeAmount || 0.001,
        maxAmount: config.maxTradeAmount || 0.01,
        buyRatio: config.buySellRatio || 0.6,
        slippageBps: config.slippageBps || 200,
        priorityFee: config.priorityFee || 10000
      },
      status: 'pending'
    });

    log.info(`Volume session created: ${session._id} for token ${tokenMint.slice(0, 8)}...`);

    // Emit event
    wsEvents.emitVolumeEvent('created', userId, session.toJSON());

    return session;

  } catch (error) {
    log.error('Create session error:', error.message);
    throw error;
  }
};

// ------------------------------------
// Start Session
// ------------------------------------

/**
 * Start a volume bot session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Started session
 */
export const startSession = async (sessionId) => {
  try {
    const session = await VolumeSession.findById(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === 'running') {
      throw new Error('Session is already running');
    }

    if (session.status === 'completed' || session.status === 'failed') {
      throw new Error('Session has already ended');
    }

    // Fund maker wallets
    await fundMakerWallets(session);

    // Update session status
    session.status = 'running';
    session.startedAt = new Date();
    session.currentState = 'trading';
    await session.save();

    // Start the trading loop
    startTradingLoop(session);

    log.info(`Volume session started: ${session._id}`);

    // Emit event
    wsEvents.emitVolumeEvent('started', session.userId.toString(), session.toJSON());

    return session;

  } catch (error) {
    log.error('Start session error:', error.message);
    throw error;
  }
};

// ------------------------------------
// Fund Maker Wallets
// ------------------------------------

/**
 * Fund maker wallets from deposit
 * @param {Object} session - Session document
 */
const fundMakerWallets = async (session) => {
  const connection = getHttpConnection();
  const user = await User.findById(session.userId);

  if (!user) {
    throw new Error('User not found');
  }

  // Get user's default trading wallet
  const tradingWallet = user.tradingWallets.find(w => w.isDefault);
  
  if (!tradingWallet) {
    throw new Error('No trading wallet configured');
  }

  // Decrypt and create keypair
  const { decrypt } = await import('../../shared/services/encryption.service.js');
  const secretKey = decrypt(tradingWallet.encryptedPrivateKey, user.walletAddress);
  const fundingWallet = Keypair.fromSecretKey(Buffer.from(secretKey, 'hex'));

  // Check balance
  const balance = await connection.getBalance(fundingWallet.publicKey);
  const requiredBalance = solToLamports(session.config.totalSolDeposited) + solToLamports(0.01); // Extra for fees

  if (balance < requiredBalance) {
    throw new Error(`Insufficient balance. Required: ${lamportsToSol(requiredBalance)} SOL`);
  }

  // Calculate amount per wallet
  const amountPerWallet = Math.floor(solToLamports(session.config.totalSolDeposited) / session.generatedWallets.length);

  session.currentState.isRunning = false;
  await session.save();

  // Fund each generated wallet
  for (let i = 0; i < session.generatedWallets.length; i++) {
    const maker = session.generatedWallets[i];
    const makerPubkey = new PublicKey(maker.publicKey);

    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fundingWallet.publicKey,
          toPubkey: makerPubkey,
          lamports: amountPerWallet
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = fundingWallet.publicKey;

      tx.sign(fundingWallet);

      const signature = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(signature);

      // Update maker balance
      session.generatedWallets[i].solBalance = lamportsToSol(amountPerWallet);

      log.debug(`Funded generated wallet ${i + 1}/${session.generatedWallets.length}: ${maker.publicKey.slice(0, 8)}...`);

    } catch (error) {
      log.error(`Failed to fund maker wallet ${i}: ${error.message}`);
      throw new Error(`Failed to fund maker wallets: ${error.message}`);
    }
  }

  await session.save();
  log.info(`All maker wallets funded for session ${session._id}`);
};

// ------------------------------------
// Trading Loop
// ------------------------------------

/**
 * Start the trading loop for a session
 * @param {Object} session - Session document
 */
const startTradingLoop = (session) => {
  const sessionId = session._id.toString();

  // Create trading state
  const state = {
    session,
    isRunning: true,
    currentWalletIndex: 0,
    lastTradeTime: Date.now()
  };

  activeSessions.set(sessionId, state);

  // Start the loop
  runTradingLoop(sessionId);
};

/**
 * Run the trading loop
 * @param {string} sessionId - Session ID
 */
const runTradingLoop = async (sessionId) => {
  const state = activeSessions.get(sessionId);
  
  if (!state || !state.isRunning) {
    return;
  }

  try {
    // Refresh session from DB
    const session = await VolumeSession.findById(sessionId);
    
    if (!session || session.status !== 'running') {
      stopTradingLoop(sessionId);
      return;
    }

    // Check if target reached or time expired
    if (session.stats.totalVolume >= session.config.targetVolume) {
      await completeSession(sessionId, 'Target volume reached');
      return;
    }

    const elapsed = Date.now() - new Date(session.startedAt).getTime();
    if (elapsed >= session.config.maxDuration) {
      await completeSession(sessionId, 'Max duration reached');
      return;
    }

    // Execute a trade
    await executeTrade(session, state);

    // Update progress
    await updateProgress(session);

    // Calculate next interval
    const interval = session.config.useRandomTiming
      ? generateRandomAmount(session.config.tradeIntervalMin, session.config.tradeIntervalMax)
      : session.config.tradeIntervalMin;

    // Schedule next trade
    setTimeout(() => runTradingLoop(sessionId), interval);

  } catch (error) {
    log.error(`Trading loop error for ${sessionId}: ${error.message}`);
    
    // Continue despite errors, but log them
    const session = await VolumeSession.findById(sessionId);
    if (session) {
      session.stats.failedTrades++;
      await session.save();
    }

    // Retry after delay
    setTimeout(() => runTradingLoop(sessionId), 5000);
  }
};

/**
 * Stop the trading loop
 * @param {string} sessionId - Session ID
 */
const stopTradingLoop = (sessionId) => {
  const state = activeSessions.get(sessionId);
  if (state) {
    state.isRunning = false;
    activeSessions.delete(sessionId);
  }
};

// ------------------------------------
// Execute Trade
// ------------------------------------

/**
 * Execute a single trade
 * @param {Object} session - Session document
 * @param {Object} state - Trading state
 */
const executeTrade = async (session, state) => {
  const connection = getHttpConnection();

  // Select maker wallet (round-robin)
  const makerIndex = state.currentWalletIndex % session.generatedWallets.length;
  const maker = session.generatedWallets[makerIndex];
  state.currentWalletIndex++;

  // Decrypt and create keypair from stored secret
  const user = await User.findById(session.userId);
  const { decrypt } = await import('../../shared/services/encryption.service.js');
  const secretKey = decrypt(maker.encryptedPrivateKey, user.walletAddress);
  const makerKeypair = Keypair.fromSecretKey(Buffer.from(secretKey, 'hex'));

  // Determine trade direction
  const isBuy = Math.random() < session.config.buySellRatio;

  // Calculate trade amount
  const tradeAmount = session.config.useRandomAmounts
    ? generateRandomAmount(session.config.minTradeAmount, session.config.maxTradeAmount)
    : session.config.minTradeAmount;

  try {
    let result;

    if (session.config.network === 'devnet') {
      // Simulate trade on devnet (just transfer between maker wallets)
      result = await simulateDevnetTrade(session, makerKeypair, isBuy, tradeAmount);
    } else {
      // Real trade on mainnet
      result = await executeRealTrade(session, makerKeypair, isBuy, tradeAmount);
    }

    if (result.success) {
      // Record successful trade
      const trade = {
        type: isBuy ? 'buy' : 'sell',
        makerWallet: maker.publicKey,
        amount: tradeAmount,
        txSignature: result.signature,
        timestamp: new Date()
      };

      session.transactions.push(trade);
      session.stats.totalTrades++;
      session.stats.totalVolume += tradeAmount;

      if (isBuy) {
        session.stats.buyCount++;
        session.stats.buyVolume += tradeAmount;
      } else {
        session.stats.sellCount++;
        session.stats.sellVolume += tradeAmount;
      }

      // Update maker stats
      session.generatedWallets[makerIndex].transactionCount++;

      await session.save();

      // Emit transaction event
      wsEvents.emitVolumeEvent('transaction', session.userId.toString(), session.toJSON(), {
        transaction: trade
      });

      log.debug(`Trade executed: ${isBuy ? 'BUY' : 'SELL'} ${tradeAmount} SOL - ${result.signature.slice(0, 8)}...`);

    } else {
      throw new Error(result.error);
    }

  } catch (error) {
    log.error(`Trade execution error: ${error.message}`);
    session.stats.failedTrades++;
    await session.save();
  }
};

/**
 * Simulate a trade on devnet
 */
const simulateDevnetTrade = async (session, makerKeypair, isBuy, amount) => {
  const connection = getHttpConnection();

  try {
    // For devnet, we'll just do SOL transfers between maker wallets to simulate volume
    // In real implementation, you'd swap tokens

    // Pick another maker wallet to transfer to
    const otherMakers = session.generatedWallets.filter(
      m => m.publicKey !== makerKeypair.publicKey.toBase58()
    );

    if (otherMakers.length === 0) {
      return { success: true, signature: 'simulated_' + Date.now() };
    }

    const targetMaker = otherMakers[Math.floor(Math.random() * otherMakers.length)];
    const targetPubkey = new PublicKey(targetMaker.publicKey);

    // Check balance
    const balance = await connection.getBalance(makerKeypair.publicKey);
    const transferAmount = Math.min(solToLamports(amount * 0.1), balance - 5000); // Keep some for fees

    if (transferAmount <= 0) {
      return { success: true, signature: 'simulated_low_balance_' + Date.now() };
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: makerKeypair.publicKey,
        toPubkey: targetPubkey,
        lamports: transferAmount
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = makerKeypair.publicKey;

    tx.sign(makerKeypair);

    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature);

    return { success: true, signature };

  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Execute a real trade on mainnet
 */
const executeRealTrade = async (session, makerKeypair, isBuy, amount) => {
  try {
    // Import Jupiter service for real swaps
    const jupiterService = (await import('../trading-engine/jupiter.service.js')).default;

    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    if (isBuy) {
      // Buy token with SOL
      const result = await jupiterService.executeSwap({
        inputMint: SOL_MINT,
        outputMint: session.tokenMint,
        amount: solToLamports(amount),
        slippageBps: 500,
        wallet: makerKeypair,
        priorityFee: 20000
      });

      return result;

    } else {
      // Sell token for SOL
      // First need to check token balance
      const connection = getHttpConnection();
      const { getAssociatedTokenAddress } = await import('@solana/spl-token');
      
      const tokenAccount = await getAssociatedTokenAddress(
        new PublicKey(session.tokenMint),
        makerKeypair.publicKey
      );

      try {
        const balance = await connection.getTokenAccountBalance(tokenAccount);
        const tokenAmount = Math.floor(balance.value.uiAmount * 0.1); // Sell 10% of balance

        if (tokenAmount <= 0) {
          // No tokens to sell, do a buy instead
          return executeRealTrade(session, makerKeypair, true, amount);
        }

        const result = await jupiterService.executeSwap({
          inputMint: session.tokenMint,
          outputMint: SOL_MINT,
          amount: tokenAmount,
          slippageBps: 500,
          wallet: makerKeypair,
          priorityFee: 20000
        });

        return result;

      } catch {
        // No token account, do a buy instead
        return executeRealTrade(session, makerKeypair, true, amount);
      }
    }

  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ------------------------------------
// Session Management
// ------------------------------------

/**
 * Update session progress
 */
const updateProgress = async (session) => {
  const elapsed = Date.now() - new Date(session.startedAt).getTime();
  const volumeProgress = (session.stats.totalVolume / session.config.targetVolume) * 100;
  const timeProgress = (elapsed / session.config.maxDuration) * 100;

  session.progress = {
    volumePercent: Math.min(volumeProgress, 100),
    timePercent: Math.min(timeProgress, 100),
    tradesPerMinute: session.stats.totalTrades / (elapsed / 60000) || 0
  };

  await session.save();

  // Emit progress event
  wsEvents.emitVolumeEvent('progress', session.userId.toString(), session.toJSON());
};

/**
 * Complete a session
 */
const completeSession = async (sessionId, reason) => {
  const session = await VolumeSession.findById(sessionId);
  
  if (!session) return;

  stopTradingLoop(sessionId);

  // Withdraw remaining funds
  await withdrawFunds(session);

  session.status = 'completed';
  session.completedAt = new Date();
  session.currentState = 'completed';
  await session.save();

  log.info(`Volume session completed: ${sessionId} - ${reason}`);

  // Emit event
  wsEvents.emitVolumeEvent('completed', session.userId.toString(), session.toJSON());
};

/**
 * Pause a session
 */
export const pauseSession = async (sessionId) => {
  const session = await VolumeSession.findById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status !== 'running') {
    throw new Error('Session is not running');
  }

  const state = activeSessions.get(sessionId);
  if (state) {
    state.isRunning = false;
  }

  session.status = 'paused';
  session.currentState = 'paused';
  await session.save();

  log.info(`Volume session paused: ${sessionId}`);

  wsEvents.emitVolumeEvent('paused', session.userId.toString(), session.toJSON());

  return session;
};

/**
 * Resume a session
 */
export const resumeSession = async (sessionId) => {
  const session = await VolumeSession.findById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status !== 'paused') {
    throw new Error('Session is not paused');
  }

  session.status = 'running';
  session.currentState = 'trading';
  await session.save();

  // Restart trading loop
  startTradingLoop(session);

  log.info(`Volume session resumed: ${sessionId}`);

  wsEvents.emitVolumeEvent('resumed', session.userId.toString(), session.toJSON());

  return session;
};

/**
 * Stop a session
 */
export const stopSession = async (sessionId) => {
  const session = await VolumeSession.findById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status === 'completed' || session.status === 'failed') {
    throw new Error('Session has already ended');
  }

  stopTradingLoop(sessionId);

  // Withdraw remaining funds
  await withdrawFunds(session);

  session.status = 'completed';
  session.completedAt = new Date();
  session.currentState = 'stopped';
  await session.save();

  log.info(`Volume session stopped: ${sessionId}`);

  wsEvents.emitVolumeEvent('stopped', session.userId.toString(), session.toJSON());

  return session;
};

// ------------------------------------
// Withdraw Funds
// ------------------------------------

/**
 * Withdraw remaining funds from maker wallets
 */
const withdrawFunds = async (session) => {
  const connection = getHttpConnection();
  const user = await User.findById(session.userId);

  if (!user) return;

  const tradingWallet = user.tradingWallets.find(w => w.isDefault);
  if (!tradingWallet) return;

  const destinationPubkey = new PublicKey(tradingWallet.publicKey);

  session.currentState = 'withdrawing';
  await session.save();

  // Import decrypt function
  const { decrypt } = await import('../../shared/services/encryption.service.js');

  for (const maker of session.generatedWallets) {
    try {
      const secretKey = decrypt(maker.encryptedPrivateKey, user.walletAddress);
      const makerKeypair = Keypair.fromSecretKey(Buffer.from(secretKey, 'hex'));
      const balance = await connection.getBalance(makerKeypair.publicKey);

      // Keep some for rent
      const withdrawAmount = balance - 5000;

      if (withdrawAmount <= 0) continue;

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: makerKeypair.publicKey,
          toPubkey: destinationPubkey,
          lamports: withdrawAmount
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = makerKeypair.publicKey;

      tx.sign(makerKeypair);

      const signature = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(signature);

      log.debug(`Withdrew ${lamportsToSol(withdrawAmount)} SOL from maker ${maker.publicKey.slice(0, 8)}...`);

    } catch (error) {
      log.error(`Withdraw error for maker ${maker.publicKey.slice(0, 8)}...: ${error.message}`);
    }
  }
};

// ------------------------------------
// Query Functions
// ------------------------------------

/**
 * Get session by ID
 */
export const getSession = async (sessionId) => {
  const session = await VolumeSession.findById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }

  return session;
};

/**
 * Get user's sessions
 */
export const getUserSessions = async (userId, options = {}) => {
  const query = { userId };

  if (options.status) {
    query.status = options.status;
  }

  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    VolumeSession.find(query)
      .select('-generatedWallets.encryptedPrivateKey -fundingWallet.encryptedPrivateKey') // Don't expose secret keys
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    VolumeSession.countDocuments(query)
  ]);

  return {
    sessions,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get active sessions count
 */
export const getActiveSessionsCount = () => {
  return activeSessions.size;
};

/**
 * Get bot status
 */
export const getStatus = async () => {
  const settings = await Settings.getSettings();

  return {
    enabled: settings.volumeBot.enabled,
    activeSessions: activeSessions.size,
    maxSessionsPerUser: settings.volumeBot.maxSessionsPerUser,
    maxDepositSol: settings.volumeBot.maxDepositSol,
    defaultNetwork: settings.volumeBot.defaultNetwork
  };
};

export default {
  createSession,
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  getSession,
  getUserSessions,
  getActiveSessionsCount,
  getStatus
};
