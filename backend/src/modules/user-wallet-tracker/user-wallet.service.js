// ===========================================
// Fusion - User Wallet Tracker Service
// ===========================================

import { PublicKey } from '@solana/web3.js';
import UserWallet from './user-wallet.model.js';
import Subwallet from '../subwallet-analyzer/subwallet.model.js';
import { getHttpConnection, wsManager as chainstackWs } from '../../config/chainstack.js';
import { wsEvents } from '../../websocket/index.js';
import { logger } from '../../shared/utils/logger.js';
import { lamportsToSol } from '../../shared/utils/helpers.js';
import { cache } from '../../config/redis.js';
import { PROGRAM_IDS, SIGNAL_TYPES } from '../../config/constants.js';

const log = logger.withContext('UserWalletTracker');

// ------------------------------------
// Tracker State
// ------------------------------------

let isTracking = false;
let trackedWallets = new Map(); // Map<address, { userWallet, subscriptionId, userId }>

// ------------------------------------
// Initialize Tracker
// ------------------------------------

/**
 * Start tracking all active user wallets
 */
export const startTracking = async () => {
  if (isTracking) {
    log.warn('User wallet tracker already running');
    return;
  }

  log.info('Starting user wallet tracker...');

  try {
    // Get all active user wallets
    const userWallets = await UserWallet.find({ isActive: true });

    if (userWallets.length === 0) {
      log.info('No active user wallets to track');
    } else {
      log.info(`Found ${userWallets.length} active user wallets to track`);

      for (const userWallet of userWallets) {
        await subscribeToWallet(userWallet);
      }
    }

    isTracking = true;
    log.info('User wallet tracker started successfully');

  } catch (error) {
    log.error('Failed to start user wallet tracker:', error.message);
    throw error;
  }
};

/**
 * Stop tracking all user wallets
 */
export const stopTracking = async () => {
  if (!isTracking) {
    return;
  }

  log.info('Stopping user wallet tracker...');

  for (const [address] of trackedWallets.entries()) {
    await unsubscribeFromWallet(address);
  }

  trackedWallets.clear();
  isTracking = false;

  log.info('User wallet tracker stopped');
};

// ------------------------------------
// Subscription Management
// ------------------------------------

/**
 * Subscribe to a user wallet
 */
export const subscribeToWallet = async (userWallet) => {
  try {
    if (trackedWallets.has(userWallet.address)) {
      return;
    }

    // Subscribe to logs for this wallet
    const subscriptionId = await chainstackWs.subscribeLogs(
      { mentions: [userWallet.address] },
      (logInfo) => {
        handleLogNotification(userWallet, logInfo);
      }
    );

    if (subscriptionId) {
      userWallet.subscriptionId = subscriptionId;
      await userWallet.save();

      trackedWallets.set(userWallet.address, {
        userWallet,
        subscriptionId,
        userId: userWallet.userId
      });

      log.debug(`Subscribed to user wallet: ${userWallet.address.slice(0, 8)}... (${userWallet.label || 'unnamed'})`);
    }

  } catch (error) {
    log.error(`Failed to subscribe to user wallet ${userWallet.address}: ${error.message}`);
  }
};

/**
 * Unsubscribe from a user wallet
 */
const unsubscribeFromWallet = async (address) => {
  const data = trackedWallets.get(address);
  if (!data) return;

  try {
    if (data.subscriptionId) {
      await chainstackWs.unsubscribe(data.subscriptionId);
    }

    data.userWallet.subscriptionId = null;
    await data.userWallet.save();

    trackedWallets.delete(address);

    log.debug(`Unsubscribed from user wallet: ${address.slice(0, 8)}...`);

  } catch (error) {
    log.error(`Failed to unsubscribe from user wallet ${address}: ${error.message}`);
  }
};

// ------------------------------------
// Log Notification Handler
// ------------------------------------

/**
 * Handle log notification for a user wallet
 */
const handleLogNotification = async (userWallet, logInfo) => {
  try {
    const { signature, err, logs } = logInfo;

    if (err) return;

    // Check if already processed
    const cacheKey = `user-wallet:${signature}`;
    const alreadyProcessed = await cache.exists(cacheKey);
    if (alreadyProcessed) return;

    await cache.set(cacheKey, '1', 3600);

    // Analyze transaction
    await analyzeTransaction(userWallet, signature, logs);

  } catch (error) {
    log.error(`Error handling user wallet log: ${error.message}`);
  }
};

// ------------------------------------
// Transaction Analysis
// ------------------------------------

/**
 * Analyze a transaction from user wallet
 */
const analyzeTransaction = async (userWallet, signature, logs) => {
  try {
    const connection = getHttpConnection();

    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!tx || tx.meta?.err) return;

    // Detect signals
    const signals = await detectSignals(tx, logs, userWallet.address);

    for (const signal of signals) {
      await processSignal(userWallet, signal, signature, tx);
    }

  } catch (error) {
    log.error(`Error analyzing user wallet transaction ${signature}: ${error.message}`);
  }
};

/**
 * Detect signals from transaction
 */
const detectSignals = async (tx, logs, walletAddress) => {
  const signals = [];
  const logsString = logs ? logs.join(' ') : '';

  // Check for token mint
  if (isMintTransaction(tx, logsString, walletAddress)) {
    const mintData = extractMintData(tx, walletAddress);
    if (mintData) {
      signals.push({
        type: SIGNAL_TYPES.MINT,
        data: mintData,
        confidence: 0.95
      });
    }
  }

  // Check for pool creation
  if (isPoolCreation(tx, logsString)) {
    const poolData = extractPoolData(tx);
    if (poolData) {
      signals.push({
        type: SIGNAL_TYPES.POOL_CREATED,
        data: poolData,
        confidence: 0.9
      });
    }
  }

  // Check for token buy
  const buyData = detectTokenBuy(tx, walletAddress);
  if (buyData) {
    signals.push({
      type: SIGNAL_TYPES.BUY,
      data: buyData,
      confidence: 0.85
    });
  }

  // Check for token sell
  const sellData = detectTokenSell(tx, walletAddress);
  if (sellData) {
    signals.push({
      type: SIGNAL_TYPES.SELL,
      data: sellData,
      confidence: 0.85
    });
  }

  // Check for large transfer
  const transferData = detectLargeTransfer(tx, walletAddress);
  if (transferData) {
    signals.push({
      type: SIGNAL_TYPES.LARGE_TRANSFER,
      data: transferData,
      confidence: 0.95
    });
  }

  return signals;
};

// ------------------------------------
// Detection Functions
// ------------------------------------

/**
 * Check if transaction is a mint
 */
const isMintTransaction = (tx, logsString, walletAddress) => {
  const mintIndicators = [
    'Program log: Instruction: Create',
    'InitializeMint',
    'Program log: Instruction: Initialize'
  ];

  return mintIndicators.some(indicator => logsString.includes(indicator));
};

/**
 * Extract mint data
 */
const extractMintData = (tx, walletAddress) => {
  try {
    const postTokenBalances = tx.meta?.postTokenBalances || [];

    for (const balance of postTokenBalances) {
      if (balance.owner === walletAddress && balance.uiTokenAmount.uiAmount > 0) {
        return {
          mint: balance.mint,
          amount: balance.uiTokenAmount.uiAmount,
          decimals: balance.uiTokenAmount.decimals
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Check if transaction is a pool creation
 */
const isPoolCreation = (tx, logsString) => {
  const poolPrograms = [
    PROGRAM_IDS.RAYDIUM_AMM,
    PROGRAM_IDS.RAYDIUM_CLMM,
    PROGRAM_IDS.RAYDIUM_CPMM
  ];

  const hasPoolProgram = tx.transaction.message.instructions.some(ix => {
    const programId = ix.programId?.toBase58?.() || ix.programId;
    return poolPrograms.includes(programId);
  });

  if (!hasPoolProgram) return false;

  const poolIndicators = ['InitializePool', 'CreatePool', 'Initialize'];
  return poolIndicators.some(indicator => logsString.includes(indicator));
};

/**
 * Extract pool data
 */
const extractPoolData = (tx) => {
  try {
    const instructions = tx.transaction.message.instructions;

    for (const ix of instructions) {
      const programId = ix.programId?.toBase58?.() || ix.programId;
      const poolPrograms = [PROGRAM_IDS.RAYDIUM_AMM, PROGRAM_IDS.RAYDIUM_CLMM, PROGRAM_IDS.RAYDIUM_CPMM];

      if (poolPrograms.includes(programId)) {
        const accounts = ix.accounts || [];
        if (accounts.length > 0) {
          return {
            poolAddress: accounts[0]?.toBase58?.() || accounts[0],
            platform: 'raydium'
          };
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Detect token buy
 */
const detectTokenBuy = (tx, walletAddress) => {
  try {
    const preTokenBalances = tx.meta?.preTokenBalances || [];
    const postTokenBalances = tx.meta?.postTokenBalances || [];
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.accountKeys;

    const walletIndex = accountKeys.findIndex(
      key => (key.pubkey?.toBase58?.() || key.pubkey) === walletAddress
    );

    if (walletIndex === -1) return null;

    // Check if SOL decreased
    const solSpent = lamportsToSol((preBalances[walletIndex] || 0) - (postBalances[walletIndex] || 0));

    if (solSpent <= 0.001) return null; // Minimum threshold

    // Find tokens received
    for (const postBalance of postTokenBalances) {
      if (postBalance.owner !== walletAddress) continue;

      const preBalance = preTokenBalances.find(
        p => p.mint === postBalance.mint && p.owner === walletAddress
      );

      const preBal = preBalance?.uiTokenAmount?.uiAmount || 0;
      const postBal = postBalance.uiTokenAmount.uiAmount || 0;
      const tokensReceived = postBal - preBal;

      if (tokensReceived > 0) {
        return {
          mint: postBalance.mint,
          amount: tokensReceived,
          solSpent,
          pricePerToken: tokensReceived > 0 ? solSpent / tokensReceived : 0
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Detect token sell
 */
const detectTokenSell = (tx, walletAddress) => {
  try {
    const preTokenBalances = tx.meta?.preTokenBalances || [];
    const postTokenBalances = tx.meta?.postTokenBalances || [];
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.accountKeys;

    const walletIndex = accountKeys.findIndex(
      key => (key.pubkey?.toBase58?.() || key.pubkey) === walletAddress
    );

    if (walletIndex === -1) return null;

    // Check if SOL increased
    const solReceived = lamportsToSol((postBalances[walletIndex] || 0) - (preBalances[walletIndex] || 0));

    if (solReceived <= 0.001) return null;

    // Find tokens sent
    for (const preBalance of preTokenBalances) {
      if (preBalance.owner !== walletAddress) continue;

      const postBalance = postTokenBalances.find(
        p => p.mint === preBalance.mint && p.owner === walletAddress
      );

      const preBal = preBalance.uiTokenAmount.uiAmount || 0;
      const postBal = postBalance?.uiTokenAmount?.uiAmount || 0;
      const tokensSold = preBal - postBal;

      if (tokensSold > 0) {
        return {
          mint: preBalance.mint,
          amount: tokensSold,
          solReceived,
          pricePerToken: tokensSold > 0 ? solReceived / tokensSold : 0
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Detect large SOL transfer
 */
const detectLargeTransfer = (tx, walletAddress) => {
  try {
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.accountKeys;

    const walletIndex = accountKeys.findIndex(
      key => (key.pubkey?.toBase58?.() || key.pubkey) === walletAddress
    );

    if (walletIndex === -1) return null;

    const balanceChange = lamportsToSol(
      (postBalances[walletIndex] || 0) - (preBalances[walletIndex] || 0)
    );

    // Large transfer threshold: 1 SOL
    if (Math.abs(balanceChange) >= 1) {
      return {
        amount: Math.abs(balanceChange),
        direction: balanceChange > 0 ? 'incoming' : 'outgoing'
      };
    }

    return null;
  } catch (error) {
    return null;
  }
};

// ------------------------------------
// Signal Processing
// ------------------------------------

/**
 * Process a detected signal
 */
const processSignal = async (userWallet, signal, signature, tx) => {
  const { type, data, confidence } = signal;

  log.info(`Signal detected: ${type} from ${userWallet.address.slice(0, 8)}... (${userWallet.label || 'unnamed'})`);

  // Record signal
  await userWallet.recordSignal({
    type,
    txSignature: signature,
    tokenMint: data.mint,
    amount: data.amount || data.solSpent || data.solReceived,
    confidence,
    metadata: data
  });

  // Check if this wallet is linked to a known subwallet
  const linkedSubwallet = await Subwallet.findOne({ address: userWallet.address });
  
  // Prepare signal data for broadcast
  const signalData = {
    walletAddress: userWallet.address,
    walletLabel: userWallet.label,
    walletNotes: userWallet.notes,
    signalType: type,
    confidence,
    txSignature: signature,
    timestamp: new Date().toISOString(),
    data,
    linkedSubwallet: linkedSubwallet ? {
      sourceHotWallet: linkedSubwallet.sourceHotWallet,
      status: linkedSubwallet.status
    } : null
  };

  // Emit to user
  wsEvents.emitUserWalletSignal(userWallet.userId.toString(), signalData);

  // Log based on type
  switch (type) {
    case SIGNAL_TYPES.MINT:
      log.info(`🪙 MINT SIGNAL: ${data.mint?.slice(0, 8)}... from tracked wallet`);
      break;
    case SIGNAL_TYPES.BUY:
      log.info(`💰 BUY SIGNAL: ${data.amount} tokens for ${data.solSpent} SOL`);
      break;
    case SIGNAL_TYPES.SELL:
      log.info(`💸 SELL SIGNAL: ${data.amount} tokens for ${data.solReceived} SOL`);
      break;
    case SIGNAL_TYPES.POOL_CREATED:
      log.info(`🏊 POOL SIGNAL: ${data.poolAddress?.slice(0, 8)}...`);
      break;
    case SIGNAL_TYPES.LARGE_TRANSFER:
      log.info(`📤 TRANSFER SIGNAL: ${data.amount} SOL ${data.direction}`);
      break;
  }
};

// ------------------------------------
// Public API
// ------------------------------------

/**
 * Add a user wallet to track
 */
export const addUserWallet = async (userId, address, options = {}) => {
  // Validate address
  try {
    new PublicKey(address);
  } catch {
    throw new Error('Invalid Solana address');
  }

  // Check if already exists for this user
  const existing = await UserWallet.findOne({ userId, address });
  if (existing) {
    throw new Error('Wallet already being tracked');
  }

  // Create user wallet
  const userWallet = await UserWallet.create({
    userId,
    address,
    label: options.label || '',
    notes: options.notes || '',
    source: options.source || 'manual',
    isActive: true
  });

  log.info(`User wallet added: ${address.slice(0, 8)}... for user ${userId}`);

  // Start tracking if tracker is running
  if (isTracking) {
    await subscribeToWallet(userWallet);
  }

  return userWallet;
};

/**
 * Remove a user wallet
 */
export const removeUserWallet = async (userId, walletId) => {
  const userWallet = await UserWallet.findOne({ _id: walletId, userId });

  if (!userWallet) {
    throw new Error('Wallet not found');
  }

  // Unsubscribe if tracking
  if (trackedWallets.has(userWallet.address)) {
    await unsubscribeFromWallet(userWallet.address);
  }

  // Soft delete
  userWallet.isActive = false;
  await userWallet.save();

  log.info(`User wallet removed: ${userWallet.address.slice(0, 8)}...`);

  return userWallet;
};

/**
 * Toggle user wallet tracking
 */
export const toggleUserWallet = async (userId, walletId) => {
  const userWallet = await UserWallet.findOne({ _id: walletId, userId });

  if (!userWallet) {
    throw new Error('Wallet not found');
  }

  userWallet.isActive = !userWallet.isActive;
  await userWallet.save();

  if (isTracking) {
    if (userWallet.isActive) {
      await subscribeToWallet(userWallet);
    } else {
      await unsubscribeFromWallet(userWallet.address);
    }
  }

  log.info(`User wallet ${userWallet.isActive ? 'enabled' : 'disabled'}: ${userWallet.address.slice(0, 8)}...`);

  return userWallet;
};

/**
 * Get user wallets for a user
 */
export const getUserWallets = async (userId, options = {}) => {
  const query = { userId };

  if (typeof options.isActive === 'boolean') {
    query.isActive = options.isActive;
  }

  const userWallets = await UserWallet.find(query)
    .sort({ createdAt: -1 });

  return userWallets.map(uw => ({
    ...uw.toObject(),
    isBeingTracked: trackedWallets.has(uw.address)
  }));
};

/**
 * Get user wallet by ID
 */
export const getUserWalletById = async (userId, walletId) => {
  const userWallet = await UserWallet.findOne({ _id: walletId, userId });

  if (!userWallet) {
    throw new Error('Wallet not found');
  }

  return {
    ...userWallet.toObject(),
    isBeingTracked: trackedWallets.has(userWallet.address)
  };
};

/**
 * Update user wallet
 */
export const updateUserWallet = async (userId, walletId, updates) => {
  const userWallet = await UserWallet.findOne({ _id: walletId, userId });

  if (!userWallet) {
    throw new Error('Wallet not found');
  }

  if (updates.label !== undefined) userWallet.label = updates.label;
  if (updates.notes !== undefined) userWallet.notes = updates.notes;

  await userWallet.save();

  return userWallet;
};

/**
 * Get signals for a user wallet
 */
export const getSignals = async (userId, walletId, options = {}) => {
  const userWallet = await UserWallet.findOne({ _id: walletId, userId });

  if (!userWallet) {
    throw new Error('Wallet not found');
  }

  let signals = userWallet.signals || [];

  // Filter by type
  if (options.type) {
    signals = signals.filter(s => s.type === options.type);
  }

  // Sort by date (newest first)
  signals.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));

  // Limit
  if (options.limit) {
    signals = signals.slice(0, options.limit);
  }

  return signals;
};

/**
 * Get all recent signals for a user
 */
export const getAllUserSignals = async (userId, limit = 50) => {
  const userWallets = await UserWallet.find({ userId, isActive: true });

  const allSignals = [];

  for (const wallet of userWallets) {
    for (const signal of wallet.signals || []) {
      allSignals.push({
        ...signal.toObject ? signal.toObject() : signal,
        walletAddress: wallet.address,
        walletLabel: wallet.label
      });
    }
  }

  // Sort by date
  allSignals.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));

  return allSignals.slice(0, limit);
};

/**
 * Import wallet from subwallet
 */
export const importFromSubwallet = async (userId, subwalletId) => {
  const subwallet = await Subwallet.findById(subwalletId);

  if (!subwallet) {
    throw new Error('Subwallet not found');
  }

  return addUserWallet(userId, subwallet.address, {
    label: `From ${subwallet.sourceHotWallet?.label || 'hot wallet'}`,
    notes: `Imported from subwallet. Original funding: ${subwallet.initialFunding?.amount || 0} SOL`,
    source: 'subwallet'
  });
};

/**
 * Get tracker status
 */
export const getTrackerStatus = () => {
  return {
    isTracking,
    trackedCount: trackedWallets.size,
    wallets: Array.from(trackedWallets.entries()).map(([address, data]) => ({
      address,
      label: data.userWallet.label,
      userId: data.userId,
      subscriptionId: data.subscriptionId
    }))
  };
};

/**
 * Get stats for a user
 */
export const getUserStats = async (userId) => {
  const userWallets = await UserWallet.find({ userId });

  const stats = {
    totalWallets: userWallets.length,
    activeWallets: userWallets.filter(w => w.isActive).length,
    totalSignals: 0,
    signalsByType: {}
  };

  for (const wallet of userWallets) {
    const signals = wallet.signals || [];
    stats.totalSignals += signals.length;

    for (const signal of signals) {
      stats.signalsByType[signal.type] = (stats.signalsByType[signal.type] || 0) + 1;
    }
  }

  return stats;
};

export default {
  startTracking,
  stopTracking,
  subscribeToWallet,
  addUserWallet,
  removeUserWallet,
  toggleUserWallet,
  getUserWallets,
  getUserWalletById,
  updateUserWallet,
  getSignals,
  getAllUserSignals,
  importFromSubwallet,
  getTrackerStatus,
  getUserStats
};
