// ===========================================
// Fusion - Hot Wallet Tracker Service
// ===========================================

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import HotWallet from './hot-wallet.model.js';
import TransferLog from './transfer-log.model.js';
import Subwallet from '../subwallet-analyzer/subwallet.model.js';
import Settings from '../settings/settings.model.js';
import { getHttpConnection, wsManager as chainstackWs } from '../../config/chainstack.js';
import { wsEvents } from '../../websocket/index.js';
import { logger } from '../../shared/utils/logger.js';
import { lamportsToSol } from '../../shared/utils/helpers.js';
import { cache } from '../../config/redis.js';

const log = logger.withContext('HotWalletTracker');

// ------------------------------------
// Tracker State
// ------------------------------------

let isTracking = false;
let trackedWallets = new Map(); // Map<address, { hotWallet, subscriptionId }>
let pollingInterval = null;

// ------------------------------------
// Initialize Tracker
// ------------------------------------

/**
 * Start tracking all active hot wallets
 */
export const startTracking = async () => {
  if (isTracking) {
    log.warn('Hot wallet tracker already running');
    return;
  }

  log.info('Starting hot wallet tracker...');

  try {
    // Get settings
    const settings = await Settings.getSettings();
    
    if (!settings.hotWalletTracking.enabled) {
      log.info('Hot wallet tracking is disabled in settings');
      return;
    }

    // Get all active hot wallets
    const hotWallets = await HotWallet.getActive();
    
    if (hotWallets.length === 0) {
      log.info('No active hot wallets to track');
      return;
    }

    log.info(`Found ${hotWallets.length} active hot wallets to track`);

    // Subscribe to each hot wallet
    for (const hotWallet of hotWallets) {
      await subscribeToWallet(hotWallet);
    }

    // Start polling as backup
    startPolling();

    isTracking = true;
    log.info('Hot wallet tracker started successfully');

  } catch (error) {
    log.error('Failed to start hot wallet tracker:', error.message);
    throw error;
  }
};

/**
 * Stop tracking all hot wallets
 */
export const stopTracking = async () => {
  if (!isTracking) {
    return;
  }

  log.info('Stopping hot wallet tracker...');

  // Unsubscribe from all wallets
  for (const [address, data] of trackedWallets.entries()) {
    await unsubscribeFromWallet(address);
  }

  // Stop polling
  stopPolling();

  trackedWallets.clear();
  isTracking = false;

  log.info('Hot wallet tracker stopped');
};

// ------------------------------------
// WebSocket Subscription
// ------------------------------------

/**
 * Subscribe to a hot wallet's account changes
 */
const subscribeToWallet = async (hotWallet) => {
  try {
    const publicKey = new PublicKey(hotWallet.address);

    // Subscribe via Chainstack WebSocket
    const subscriptionId = await chainstackWs.subscribeToAccount(
      publicKey,
      (accountInfo, context) => {
        handleAccountChange(hotWallet, accountInfo, context);
      }
    );

    if (subscriptionId) {
      // Update hot wallet with subscription ID
      await hotWallet.startTracking(subscriptionId);

      trackedWallets.set(hotWallet.address, {
        hotWallet,
        subscriptionId
      });

      log.info(`Subscribed to hot wallet: ${hotWallet.label} (${hotWallet.address.slice(0, 8)}...)`);
    }

  } catch (error) {
    log.error(`Failed to subscribe to ${hotWallet.address}: ${error.message}`);
  }
};

/**
 * Unsubscribe from a hot wallet
 */
const unsubscribeFromWallet = async (address) => {
  const data = trackedWallets.get(address);
  if (!data) return;

  try {
    if (data.subscriptionId) {
      await chainstackWs.unsubscribe(data.subscriptionId);
    }

    await data.hotWallet.stopTracking();
    trackedWallets.delete(address);

    log.info(`Unsubscribed from hot wallet: ${address.slice(0, 8)}...`);

  } catch (error) {
    log.error(`Failed to unsubscribe from ${address}: ${error.message}`);
  }
};

// ------------------------------------
// Account Change Handler
// ------------------------------------

/**
 * Handle account change notification
 */
const handleAccountChange = async (hotWallet, accountInfo, context) => {
  try {
    // Get recent signatures to find the transfer
    const connection = getHttpConnection();
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(hotWallet.address),
      { limit: 5 }
    );

    if (signatures.length === 0) return;

    // Process the most recent signature
    const latestSig = signatures[0];
    
    // Check if we already processed this
    const cacheKey = `processed:${latestSig.signature}`;
    const alreadyProcessed = await cache.exists(cacheKey);
    
    if (alreadyProcessed) return;

    // Mark as processed (expire in 1 hour)
    await cache.set(cacheKey, '1', 3600);

    // Get transaction details
    await processTransaction(hotWallet, latestSig.signature);

  } catch (error) {
    log.error(`Error handling account change for ${hotWallet.address}: ${error.message}`);
  }
};

// ------------------------------------
// Transaction Processing
// ------------------------------------

/**
 * Process a transaction from hot wallet
 */
const processTransaction = async (hotWallet, signature) => {
  try {
    const connection = getHttpConnection();
    
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!tx || tx.meta?.err) return;

    // Find SOL transfers from this hot wallet
    const transfers = extractSOLTransfers(tx, hotWallet.address);

    for (const transfer of transfers) {
      await handleTransfer(hotWallet, transfer, signature);
    }

  } catch (error) {
    log.error(`Error processing transaction ${signature}: ${error.message}`);
  }
};

/**
 * Extract SOL transfers from transaction
 */
const extractSOLTransfers = (tx, fromAddress) => {
  const transfers = [];
  const preBalances = tx.meta?.preBalances || [];
  const postBalances = tx.meta?.postBalances || [];
  const accountKeys = tx.transaction.message.accountKeys;

  // Find the index of our hot wallet
  const fromIndex = accountKeys.findIndex(
    key => key.pubkey?.toBase58?.() === fromAddress || key.pubkey === fromAddress
  );

  if (fromIndex === -1) return transfers;

  // Check each account for balance changes
  for (let i = 0; i < accountKeys.length; i++) {
    if (i === fromIndex) continue;

    const preBal = preBalances[i] || 0;
    const postBal = postBalances[i] || 0;
    const diff = postBal - preBal;

    // If account received SOL (positive diff)
    if (diff > 0) {
      const toAddress = accountKeys[i].pubkey?.toBase58?.() || accountKeys[i].pubkey;
      
      transfers.push({
        to: toAddress,
        amount: lamportsToSol(diff)
      });
    }
  }

  return transfers;
};

/**
 * Handle a single transfer
 */
const handleTransfer = async (hotWallet, transfer, signature) => {
  try {
    // Get settings for minimum amount
    const settings = await Settings.getSettings();
    const minAmount = settings.hotWalletTracking.minTransferAmount;

    // Skip if below minimum
    if (transfer.amount < minAmount) {
      log.debug(`Skipping small transfer: ${transfer.amount} SOL`);
      return;
    }

    log.info(`Hot wallet transfer detected: ${hotWallet.label} -> ${transfer.to.slice(0, 8)}... (${transfer.amount} SOL)`);

    // Record transfer in hot wallet stats
    await hotWallet.recordTransfer(transfer.to, transfer.amount, signature);

    // Check if destination is a new subwallet
    const isNewSubwallet = await checkAndCreateSubwallet(
      hotWallet,
      transfer.to,
      transfer.amount,
      signature
    );

    // Log the transfer
    await TransferLog.createLog({
      fromWallet: hotWallet.address,
      toWallet: transfer.to,
      amount: transfer.amount,
      txSignature: signature,
      source: 'hot_wallet',
      relatedHotWallet: hotWallet._id,
      context: {
        exchange: hotWallet.exchange,
        label: hotWallet.label,
        isInitialFunding: isNewSubwallet
      }
    });

    // Emit WebSocket event
    wsEvents.emitHotWalletTransfer({
      hotWalletAddress: hotWallet.address,
      exchange: hotWallet.exchange,
      toAddress: transfer.to,
      amount: transfer.amount,
      txSignature: signature,
      isNewSubwallet
    });

  } catch (error) {
    log.error(`Error handling transfer: ${error.message}`);
  }
};

/**
 * Check if destination is new and create subwallet
 */
const checkAndCreateSubwallet = async (hotWallet, toAddress, amount, signature) => {
  try {
    // Check if already tracking this address
    const existing = await Subwallet.findOne({ address: toAddress });
    
    if (existing) {
      log.debug(`Address already tracked: ${toAddress.slice(0, 8)}...`);
      return false;
    }

    // Check max active subwallets
    const settings = await Settings.getSettings();
    const activeCount = await Subwallet.countDocuments({ 
      status: { $in: ['watching', 'active'] } 
    });

    if (activeCount >= settings.hotWalletTracking.maxActiveSubwallets) {
      log.warn(`Max active subwallets reached (${activeCount}), skipping new subwallet`);
      return false;
    }

    // Create new subwallet
    const subwallet = await Subwallet.findOrCreate(toAddress, hotWallet._id, {
      amount,
      signature,
      timestamp: new Date()
    });

    log.info(`New subwallet created: ${toAddress.slice(0, 8)}... from ${hotWallet.label}`);

    // Emit event
    wsEvents.emitNewSubwallet({
      address: toAddress,
      sourceHotWallet: {
        address: hotWallet.address,
        exchange: hotWallet.exchange,
        label: hotWallet.label
      },
      initialAmount: amount,
      txSignature: signature
    });

    // Increment unique destinations
    await hotWallet.incrementUniqueDestinations();

    return true;

  } catch (error) {
    log.error(`Error creating subwallet: ${error.message}`);
    return false;
  }
};

// ------------------------------------
// Polling Backup
// ------------------------------------

/**
 * Start polling as backup for WebSocket
 */
const startPolling = () => {
  if (pollingInterval) return;

  const pollIntervalMs = 30000; // 30 seconds

  pollingInterval = setInterval(async () => {
    for (const [address, data] of trackedWallets.entries()) {
      try {
        await pollWallet(data.hotWallet);
      } catch (error) {
        log.error(`Polling error for ${address}: ${error.message}`);
      }
    }
  }, pollIntervalMs);

  log.debug('Polling backup started');
};

/**
 * Stop polling
 */
const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
};

/**
 * Poll a single wallet for recent transactions
 */
const pollWallet = async (hotWallet) => {
  try {
    const connection = getHttpConnection();
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(hotWallet.address),
      { limit: 10 }
    );

    for (const sig of signatures) {
      const cacheKey = `processed:${sig.signature}`;
      const alreadyProcessed = await cache.exists(cacheKey);
      
      if (!alreadyProcessed) {
        await cache.set(cacheKey, '1', 3600);
        await processTransaction(hotWallet, sig.signature);
      }
    }

  } catch (error) {
    log.error(`Poll error for ${hotWallet.address}: ${error.message}`);
  }
};

// ------------------------------------
// Hot Wallet Management
// ------------------------------------

/**
 * Add a new hot wallet to track
 */
export const addHotWallet = async (data) => {
  const { address, exchange, label } = data;

  // Validate address
  try {
    new PublicKey(address);
  } catch {
    throw new Error('Invalid Solana address');
  }

  // Check if already exists
  const existing = await HotWallet.findOne({ address });
  if (existing) {
    throw new Error('Hot wallet already exists');
  }

  // Create hot wallet
  const hotWallet = await HotWallet.create({
    address,
    exchange: exchange.toLowerCase(),
    label: label || `${exchange} Hot Wallet`,
    isActive: true
  });

  log.info(`Hot wallet added: ${hotWallet.label}`);

  // Start tracking if tracker is running
  if (isTracking) {
    await subscribeToWallet(hotWallet);
  }

  return hotWallet;
};

/**
 * Remove a hot wallet
 */
export const removeHotWallet = async (walletId) => {
  const hotWallet = await HotWallet.findById(walletId);
  
  if (!hotWallet) {
    throw new Error('Hot wallet not found');
  }

  // Unsubscribe if tracking
  if (trackedWallets.has(hotWallet.address)) {
    await unsubscribeFromWallet(hotWallet.address);
  }

  // Soft delete (set inactive)
  hotWallet.isActive = false;
  await hotWallet.save();

  log.info(`Hot wallet removed: ${hotWallet.label}`);

  return hotWallet;
};

/**
 * Toggle hot wallet active status
 */
export const toggleHotWallet = async (walletId) => {
  const hotWallet = await HotWallet.findById(walletId);
  
  if (!hotWallet) {
    throw new Error('Hot wallet not found');
  }

  hotWallet.isActive = !hotWallet.isActive;
  await hotWallet.save();

  if (isTracking) {
    if (hotWallet.isActive) {
      await subscribeToWallet(hotWallet);
    } else {
      await unsubscribeFromWallet(hotWallet.address);
    }
  }

  log.info(`Hot wallet ${hotWallet.isActive ? 'enabled' : 'disabled'}: ${hotWallet.label}`);

  return hotWallet;
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
      exchange: data.hotWallet.exchange,
      label: data.hotWallet.label,
      subscriptionId: data.subscriptionId
    }))
  };
};

/**
 * Get all hot wallets with stats
 */
export const getAllHotWallets = async (options = {}) => {
  const query = {};
  
  if (typeof options.isActive === 'boolean') {
    query.isActive = options.isActive;
  }

  if (options.exchange) {
    query.exchange = options.exchange.toLowerCase();
  }

  const hotWallets = await HotWallet.find(query)
    .sort({ exchange: 1, createdAt: -1 });

  return hotWallets.map(hw => ({
    ...hw.toObject(),
    isTracking: trackedWallets.has(hw.address)
  }));
};

/**
 * Get hot wallet by ID
 */
export const getHotWalletById = async (walletId) => {
  const hotWallet = await HotWallet.findById(walletId);
  
  if (!hotWallet) {
    throw new Error('Hot wallet not found');
  }

  return {
    ...hotWallet.toObject(),
    isTracking: trackedWallets.has(hotWallet.address)
  };
};

/**
 * Get recent transfers from hot wallets
 */
export const getRecentTransfers = async (options = {}) => {
  const query = { source: 'hot_wallet' };

  if (options.hotWalletId) {
    query.relatedHotWallet = options.hotWalletId;
  }

  const transfers = await TransferLog.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .populate('relatedHotWallet', 'address exchange label');

  return transfers;
};

export default {
  startTracking,
  stopTracking,
  addHotWallet,
  removeHotWallet,
  toggleHotWallet,
  getTrackerStatus,
  getAllHotWallets,
  getHotWalletById,
  getRecentTransfers
};
