// ===========================================
// Fusion - Subwallet Analyzer Service
// ===========================================

import { PublicKey } from '@solana/web3.js';
import Subwallet from './subwallet.model.js';
import Settings from '../settings/settings.model.js';
import { getHttpConnection, wsManager as chainstackWs } from '../../config/chainstack.js';
import { wsEvents } from '../../websocket/index.js';
import { logger } from '../../shared/utils/logger.js';
import { lamportsToSol } from '../../shared/utils/helpers.js';
import { cache } from '../../config/redis.js';
import { PROGRAM_IDS } from '../../config/constants.js';

const log = logger.withContext('SubwalletAnalyzer');

// ------------------------------------
// Analyzer State
// ------------------------------------

let isAnalyzing = false;
let analyzedWallets = new Map(); // Map<address, { subwallet, subscriptionId }>
let cleanupInterval = null;

// ------------------------------------
// Initialize Analyzer
// ------------------------------------

/**
 * Start analyzing all active subwallets
 */
export const startAnalyzing = async () => {
  if (isAnalyzing) {
    log.warn('Subwallet analyzer already running');
    return;
  }

  log.info('Starting subwallet analyzer...');

  try {
    // Get all watching subwallets
    const subwallets = await Subwallet.getWatching();

    if (subwallets.length === 0) {
      log.info('No subwallets to analyze');
    } else {
      log.info(`Found ${subwallets.length} subwallets to analyze`);

      // Subscribe to each subwallet
      for (const subwallet of subwallets) {
        await subscribeToSubwallet(subwallet);
      }
    }

    // Start cleanup interval (check expired subwallets every 5 minutes)
    startCleanupInterval();

    isAnalyzing = true;
    log.info('Subwallet analyzer started successfully');

  } catch (error) {
    log.error('Failed to start subwallet analyzer:', error.message);
    throw error;
  }
};

/**
 * Stop analyzing all subwallets
 */
export const stopAnalyzing = async () => {
  if (!isAnalyzing) {
    return;
  }

  log.info('Stopping subwallet analyzer...');

  // Unsubscribe from all
  for (const [address] of analyzedWallets.entries()) {
    await unsubscribeFromSubwallet(address);
  }

  // Stop cleanup interval
  stopCleanupInterval();

  analyzedWallets.clear();
  isAnalyzing = false;

  log.info('Subwallet analyzer stopped');
};

// ------------------------------------
// Subscription Management
// ------------------------------------

/**
 * Subscribe to a subwallet's transactions
 */
export const subscribeToSubwallet = async (subwallet) => {
  try {
    // Check if already subscribed
    if (analyzedWallets.has(subwallet.address)) {
      return;
    }

    const publicKey = new PublicKey(subwallet.address);

    // Subscribe to logs for this wallet
    const subscriptionId = await chainstackWs.subscribeLogs(
      { mentions: [subwallet.address] },
      (logInfo, context) => {
        handleLogNotification(subwallet, logInfo);
      }
    );

    if (subscriptionId) {
      subwallet.subscriptionId = subscriptionId;
      await subwallet.save();

      analyzedWallets.set(subwallet.address, {
        subwallet,
        subscriptionId
      });

      log.debug(`Subscribed to subwallet: ${subwallet.address.slice(0, 8)}...`);
    }

  } catch (error) {
    log.error(`Failed to subscribe to subwallet ${subwallet.address}: ${error.message}`);
  }
};

/**
 * Unsubscribe from a subwallet
 */
const unsubscribeFromSubwallet = async (address) => {
  const data = analyzedWallets.get(address);
  if (!data) return;

  try {
    if (data.subscriptionId) {
      await chainstackWs.unsubscribe(data.subscriptionId);
    }

    data.subwallet.subscriptionId = null;
    await data.subwallet.save();

    analyzedWallets.delete(address);

    log.debug(`Unsubscribed from subwallet: ${address.slice(0, 8)}...`);

  } catch (error) {
    log.error(`Failed to unsubscribe from subwallet ${address}: ${error.message}`);
  }
};

// ------------------------------------
// Log Notification Handler
// ------------------------------------

/**
 * Handle log notification for a subwallet
 */
const handleLogNotification = async (subwallet, logInfo) => {
  try {
    const { signature, err, logs } = logInfo;

    // Skip failed transactions
    if (err) return;

    // Check if already processed
    const cacheKey = `analyzed:${signature}`;
    const alreadyProcessed = await cache.exists(cacheKey);
    if (alreadyProcessed) return;

    // Mark as processed
    await cache.set(cacheKey, '1', 3600);

    // Analyze the transaction
    await analyzeTransaction(subwallet, signature, logs);

  } catch (error) {
    log.error(`Error handling log notification: ${error.message}`);
  }
};

// ------------------------------------
// Transaction Analysis
// ------------------------------------

/**
 * Analyze a transaction for activity types
 */
const analyzeTransaction = async (subwallet, signature, logs) => {
  try {
    const connection = getHttpConnection();

    // Get full transaction details
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!tx || tx.meta?.err) return;

    // Detect activity type
    const activities = detectActivityType(tx, logs, subwallet.address);

    for (const activity of activities) {
      await processActivity(subwallet, activity, signature, tx);
    }

    // Update last activity
    if (activities.length > 0) {
      subwallet.activity.lastActivityAt = new Date();
      subwallet.activity.transactionCount += 1;
      await subwallet.save();
    }

  } catch (error) {
    log.error(`Error analyzing transaction ${signature}: ${error.message}`);
  }
};

/**
 * Detect activity types from transaction
 */
const detectActivityType = (tx, logs, walletAddress) => {
  const activities = [];
  const logsString = logs ? logs.join(' ') : '';
  const instructions = tx.transaction.message.instructions || [];

  // Check for Pump.fun mint
  if (isPumpFunMint(tx, logsString, walletAddress)) {
    const mintData = extractPumpFunMintData(tx, walletAddress);
    if (mintData) {
      activities.push({ type: 'mint', platform: 'pump.fun', data: mintData });
    }
  }

  // Check for Raydium pool creation
  if (isRaydiumPoolCreation(tx, logsString)) {
    const poolData = extractRaydiumPoolData(tx);
    if (poolData) {
      activities.push({ type: 'pool', platform: 'raydium', data: poolData });
    }
  }

  // Check for token buy (Jupiter or Raydium swap)
  const buyData = detectTokenBuy(tx, walletAddress);
  if (buyData) {
    activities.push({ type: 'buy', platform: buyData.dex, data: buyData });
  }

  return activities;
};

// ------------------------------------
// Pump.fun Detection
// ------------------------------------

/**
 * Check if transaction is a Pump.fun mint
 */
const isPumpFunMint = (tx, logsString, walletAddress) => {
  // Check for Pump.fun program
  const hasPumpFun = tx.transaction.message.instructions.some(ix => {
    const programId = ix.programId?.toBase58?.() || ix.programId;
    return programId === PROGRAM_IDS.PUMP_FUN;
  });

  if (!hasPumpFun) return false;

  // Check logs for mint indication
  const mintIndicators = [
    'Program log: Instruction: Create',
    'Program log: Instruction: Initialize',
    'InitializeMint'
  ];

  return mintIndicators.some(indicator => logsString.includes(indicator));
};

/**
 * Extract Pump.fun mint data
 */
const extractPumpFunMintData = (tx, walletAddress) => {
  try {
    const postTokenBalances = tx.meta?.postTokenBalances || [];

    // Find new token mint
    for (const balance of postTokenBalances) {
      if (balance.owner === walletAddress && balance.uiTokenAmount.uiAmount > 0) {
        return {
          mint: balance.mint,
          amount: balance.uiTokenAmount.uiAmount,
          decimals: balance.uiTokenAmount.decimals
        };
      }
    }

    // Fallback: look for token in instructions
    const instructions = tx.transaction.message.instructions;
    for (const ix of instructions) {
      if (ix.parsed?.type === 'initializeMint' || ix.parsed?.type === 'initializeMint2') {
        return {
          mint: ix.parsed.info.mint,
          decimals: ix.parsed.info.decimals || 9
        };
      }
    }

    return null;
  } catch (error) {
    log.error('Error extracting pump.fun mint data:', error.message);
    return null;
  }
};

// ------------------------------------
// Raydium Pool Detection
// ------------------------------------

/**
 * Check if transaction is a Raydium pool creation
 */
const isRaydiumPoolCreation = (tx, logsString) => {
  const raydiumPrograms = [
    PROGRAM_IDS.RAYDIUM_AMM,
    PROGRAM_IDS.RAYDIUM_CLMM,
    PROGRAM_IDS.RAYDIUM_CPMM
  ];

  const hasRaydium = tx.transaction.message.instructions.some(ix => {
    const programId = ix.programId?.toBase58?.() || ix.programId;
    return raydiumPrograms.includes(programId);
  });

  if (!hasRaydium) return false;

  // Check logs for pool creation
  const poolIndicators = [
    'Program log: Instruction: Initialize',
    'Program log: ray_log',
    'InitializePool',
    'CreatePool'
  ];

  return poolIndicators.some(indicator => logsString.includes(indicator));
};

/**
 * Extract Raydium pool data
 */
const extractRaydiumPoolData = (tx) => {
  try {
    const instructions = tx.transaction.message.instructions;
    const accountKeys = tx.transaction.message.accountKeys;

    // Look for pool account in instructions
    for (const ix of instructions) {
      const programId = ix.programId?.toBase58?.() || ix.programId;

      if ([PROGRAM_IDS.RAYDIUM_AMM, PROGRAM_IDS.RAYDIUM_CLMM, PROGRAM_IDS.RAYDIUM_CPMM].includes(programId)) {
        // Extract accounts
        const accounts = ix.accounts || [];
        
        if (accounts.length > 0) {
          return {
            poolAddress: accounts[0]?.toBase58?.() || accounts[0],
            tokenMint: accounts[1]?.toBase58?.() || accounts[1]
          };
        }
      }
    }

    return null;
  } catch (error) {
    log.error('Error extracting Raydium pool data:', error.message);
    return null;
  }
};

// ------------------------------------
// Token Buy Detection
// ------------------------------------

/**
 * Detect token buy from transaction
 */
const detectTokenBuy = (tx, walletAddress) => {
  try {
    const preTokenBalances = tx.meta?.preTokenBalances || [];
    const postTokenBalances = tx.meta?.postTokenBalances || [];
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.accountKeys;

    // Find wallet index
    const walletIndex = accountKeys.findIndex(
      key => (key.pubkey?.toBase58?.() || key.pubkey) === walletAddress
    );

    if (walletIndex === -1) return null;

    // Check if SOL decreased (spent)
    const solSpent = lamportsToSol((preBalances[walletIndex] || 0) - (postBalances[walletIndex] || 0));

    if (solSpent <= 0) return null; // No SOL spent, not a buy

    // Find new tokens received
    for (const postBalance of postTokenBalances) {
      if (postBalance.owner !== walletAddress) continue;

      const preBalance = preTokenBalances.find(
        p => p.mint === postBalance.mint && p.owner === walletAddress
      );

      const preBal = preBalance?.uiTokenAmount?.uiAmount || 0;
      const postBal = postBalance.uiTokenAmount.uiAmount || 0;
      const tokenReceived = postBal - preBal;

      if (tokenReceived > 0) {
        // Determine DEX
        const dex = detectDex(tx);

        return {
          mint: postBalance.mint,
          amount: tokenReceived,
          solSpent: solSpent,
          pricePerToken: tokenReceived > 0 ? solSpent / tokenReceived : 0,
          dex
        };
      }
    }

    return null;
  } catch (error) {
    log.error('Error detecting token buy:', error.message);
    return null;
  }
};

/**
 * Detect which DEX was used
 */
const detectDex = (tx) => {
  const instructions = tx.transaction.message.instructions;

  for (const ix of instructions) {
    const programId = ix.programId?.toBase58?.() || ix.programId;

    if (programId === PROGRAM_IDS.JUPITER_V6) {
      return 'jupiter';
    }

    if ([PROGRAM_IDS.RAYDIUM_AMM, PROGRAM_IDS.RAYDIUM_CLMM, PROGRAM_IDS.RAYDIUM_CPMM].includes(programId)) {
      return 'raydium';
    }

    if (programId === PROGRAM_IDS.PUMP_FUN) {
      return 'pump.fun';
    }
  }

  return 'unknown';
};

// ------------------------------------
// Activity Processing
// ------------------------------------

/**
 * Process detected activity
 */
const processActivity = async (subwallet, activity, signature, tx) => {
  const { type, platform, data } = activity;

  log.info(`Activity detected: ${type} on ${platform} for ${subwallet.address.slice(0, 8)}...`);

  switch (type) {
    case 'mint':
      await processMint(subwallet, data, signature, platform);
      break;

    case 'pool':
      await processPoolCreation(subwallet, data, signature, platform);
      break;

    case 'buy':
      await processTokenBuy(subwallet, data, signature);
      break;
  }
};

/**
 * Process token mint
 */
const processMint = async (subwallet, data, signature, platform) => {
  // Get token metadata
  let tokenName = 'Unknown Token';
  let tokenSymbol = 'UNKNOWN';

  try {
    const { getTokenMetadata } = await import('../../shared/services/solana.service.js');
    const metadata = await getTokenMetadata(data.mint);
    if (metadata) {
      tokenName = metadata.name || tokenName;
      tokenSymbol = metadata.symbol || tokenSymbol;
    }
  } catch (error) {
    log.debug('Could not fetch token metadata:', error.message);
  }

  // Record mint
  await subwallet.recordMint({
    mint: data.mint,
    name: tokenName,
    symbol: tokenSymbol,
    decimals: data.decimals || 9,
    platform,
    txSignature: signature
  });

  // Emit event
  wsEvents.emitSubwalletMint({
    subwalletAddress: subwallet.address,
    sourceHotWallet: subwallet.sourceHotWallet,
    tokenMint: data.mint,
    tokenName,
    tokenSymbol,
    platform,
    txSignature: signature
  });

  log.info(`🪙 MINT DETECTED: ${tokenSymbol} (${data.mint.slice(0, 8)}...) from ${subwallet.address.slice(0, 8)}...`);
};

/**
 * Process pool creation
 */
const processPoolCreation = async (subwallet, data, signature, platform) => {
  // Record pool creation
  await subwallet.recordPoolCreation({
    poolAddress: data.poolAddress,
    tokenMint: data.tokenMint,
    platform,
    txSignature: signature
  });

  // Emit event
  wsEvents.emitSubwalletPool({
    subwalletAddress: subwallet.address,
    sourceHotWallet: subwallet.sourceHotWallet,
    poolAddress: data.poolAddress,
    tokenMint: data.tokenMint,
    platform,
    txSignature: signature
  });

  log.info(`🏊 POOL CREATED: ${data.poolAddress.slice(0, 8)}... from ${subwallet.address.slice(0, 8)}...`);
};

/**
 * Process token buy
 */
const processTokenBuy = async (subwallet, data, signature) => {
  // Record token purchase
  await subwallet.recordTokenPurchase({
    mint: data.mint,
    amount: data.amount,
    solSpent: data.solSpent,
    pricePerToken: data.pricePerToken,
    dex: data.dex,
    txSignature: signature
  });

  // Emit event
  wsEvents.emitSubwalletBuy({
    subwalletAddress: subwallet.address,
    sourceHotWallet: subwallet.sourceHotWallet,
    tokenMint: data.mint,
    amount: data.amount,
    solSpent: data.solSpent,
    dex: data.dex,
    txSignature: signature
  });

  log.info(`💰 BUY DETECTED: ${data.amount} tokens for ${data.solSpent} SOL from ${subwallet.address.slice(0, 8)}...`);
};

// ------------------------------------
// Cleanup Management
// ------------------------------------

/**
 * Start cleanup interval
 */
const startCleanupInterval = () => {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(async () => {
    await cleanupExpiredSubwallets();
  }, 5 * 60 * 1000); // Every 5 minutes

  log.debug('Cleanup interval started');
};

/**
 * Stop cleanup interval
 */
const stopCleanupInterval = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

/**
 * Archive expired subwallets
 */
const cleanupExpiredSubwallets = async () => {
  try {
    // Get expired watching subwallets
    const expired = await Subwallet.getExpired();

    for (const subwallet of expired) {
      // Unsubscribe
      await unsubscribeFromSubwallet(subwallet.address);

      // Archive if no activity
      if (!subwallet.hasAnyActivity) {
        await subwallet.archive();
        log.debug(`Archived inactive subwallet: ${subwallet.address.slice(0, 8)}...`);
      } else {
        // Keep active subwallets but mark as inactive
        subwallet.status = 'inactive';
        await subwallet.save();
      }
    }

    // Bulk archive
    const archivedCount = await Subwallet.archiveExpired();
    
    if (archivedCount > 0) {
      log.info(`Archived ${archivedCount} expired subwallets`);
    }

  } catch (error) {
    log.error('Error during cleanup:', error.message);
  }
};

// ------------------------------------
// Public API
// ------------------------------------

/**
 * Get all subwallets
 */
export const getSubwallets = async (options = {}) => {
  const query = {};

  if (options.status) {
    query.status = options.status;
  }

  if (options.hotWalletId) {
    query.sourceHotWallet = options.hotWalletId;
  }

  if (options.hasMinted !== undefined) {
    query['activity.hasMinted'] = options.hasMinted;
  }

  if (options.hasCreatedPool !== undefined) {
    query['activity.hasCreatedPool'] = options.hasCreatedPool;
  }

  if (options.hasBoughtToken !== undefined) {
    query['activity.hasBoughtToken'] = options.hasBoughtToken;
  }

  const page = options.page || 1;
  const limit = options.limit || 50;
  const skip = (page - 1) * limit;

  const [subwallets, total] = await Promise.all([
    Subwallet.find(query)
      .populate('sourceHotWallet', 'address exchange label')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Subwallet.countDocuments(query)
  ]);

  return {
    subwallets: subwallets.map(sw => ({
      ...sw.toObject(),
      isBeingAnalyzed: analyzedWallets.has(sw.address)
    })),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get subwallet by ID
 */
export const getSubwalletById = async (id) => {
  const subwallet = await Subwallet.findById(id)
    .populate('sourceHotWallet', 'address exchange label');

  if (!subwallet) {
    throw new Error('Subwallet not found');
  }

  return {
    ...subwallet.toObject(),
    isBeingAnalyzed: analyzedWallets.has(subwallet.address)
  };
};

/**
 * Get subwallet by address
 */
export const getSubwalletByAddress = async (address) => {
  const subwallet = await Subwallet.findOne({ address })
    .populate('sourceHotWallet', 'address exchange label');

  return subwallet ? {
    ...subwallet.toObject(),
    isBeingAnalyzed: analyzedWallets.has(subwallet.address)
  } : null;
};

/**
 * Get recent mints
 */
export const getRecentMints = async (limit = 20) => {
  return Subwallet.getRecentMints(limit);
};

/**
 * Get stats summary
 */
export const getStats = async () => {
  const stats = await Subwallet.getStatsSummary();
  
  return {
    ...stats,
    analyzerRunning: isAnalyzing,
    activelyAnalyzing: analyzedWallets.size
  };
};

/**
 * Get analyzer status
 */
export const getAnalyzerStatus = () => {
  return {
    isAnalyzing,
    analyzedCount: analyzedWallets.size,
    wallets: Array.from(analyzedWallets.entries()).map(([address, data]) => ({
      address,
      status: data.subwallet.status,
      subscriptionId: data.subscriptionId
    }))
  };
};

/**
 * Manually add a wallet to analyze
 */
export const addSubwallet = async (address, hotWalletId, amount = 0) => {
  // Create subwallet
  const subwallet = await Subwallet.findOrCreate(address, hotWalletId, {
    amount,
    signature: 'manual',
    timestamp: new Date()
  });

  // Start analyzing if analyzer is running
  if (isAnalyzing) {
    await subscribeToSubwallet(subwallet);
  }

  return subwallet;
};

/**
 * Extend watch time for a subwallet
 */
export const extendWatchTime = async (id, hours = 24) => {
  const subwallet = await Subwallet.findById(id);
  
  if (!subwallet) {
    throw new Error('Subwallet not found');
  }

  await subwallet.extendWatchTime(hours);

  // Resubscribe if not already
  if (isAnalyzing && !analyzedWallets.has(subwallet.address)) {
    await subscribeToSubwallet(subwallet);
  }

  return subwallet;
};

export default {
  startAnalyzing,
  stopAnalyzing,
  subscribeToSubwallet,
  getSubwallets,
  getSubwalletById,
  getSubwalletByAddress,
  getRecentMints,
  getStats,
  getAnalyzerStatus,
  addSubwallet,
  extendWatchTime
};
