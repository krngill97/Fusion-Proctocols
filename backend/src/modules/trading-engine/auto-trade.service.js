// ===========================================
// Fusion - Auto-Trade Strategy Manager
// ===========================================

import User from '../auth/auth.model.js';
import Trade from './trading.model.js';
import * as tradingService from './trading.service.js';
import { wsEvents } from '../../websocket/index.js';
import { logger } from '../../shared/utils/logger.js';
import { cache } from '../../config/redis.js';

const log = logger.withContext('AutoTradeManager');

// ------------------------------------
// Strategy Types
// ------------------------------------

export const STRATEGY_TYPES = {
  COPY_TRADE: 'copy_trade',      // Copy trades from tracked wallets
  SNIPE_MINT: 'snipe_mint',      // Buy new mints immediately
  SNIPE_POOL: 'snipe_pool',      // Buy when pool is created
  TAKE_PROFIT: 'take_profit',    // Auto-sell at profit target
  STOP_LOSS: 'stop_loss',        // Auto-sell at loss limit
  DCA: 'dca'                     // Dollar cost average
};

// ------------------------------------
// Active Strategies State
// ------------------------------------

let activeStrategies = new Map(); // Map<strategyId, strategy>
let isRunning = false;

// ------------------------------------
// Initialize Manager
// ------------------------------------

/**
 * Start the auto-trade manager
 */
export const start = async () => {
  if (isRunning) {
    log.warn('Auto-trade manager already running');
    return;
  }

  log.info('Starting auto-trade manager...');

  // Load active strategies from all users
  await loadActiveStrategies();

  isRunning = true;
  log.info(`Auto-trade manager started with ${activeStrategies.size} active strategies`);
};

/**
 * Stop the auto-trade manager
 */
export const stop = async () => {
  if (!isRunning) {
    return;
  }

  log.info('Stopping auto-trade manager...');

  activeStrategies.clear();
  isRunning = false;

  log.info('Auto-trade manager stopped');
};

/**
 * Load active strategies from database
 */
const loadActiveStrategies = async () => {
  try {
    const users = await User.find({
      'autoTradeSettings.enabled': true
    });

    for (const user of users) {
      const settings = user.autoTradeSettings;

      if (settings.copyTrading?.enabled) {
        registerStrategy({
          id: `${user._id}_copy_trade`,
          userId: user._id,
          type: STRATEGY_TYPES.COPY_TRADE,
          config: settings.copyTrading
        });
      }

      if (settings.snipeMints?.enabled) {
        registerStrategy({
          id: `${user._id}_snipe_mint`,
          userId: user._id,
          type: STRATEGY_TYPES.SNIPE_MINT,
          config: settings.snipeMints
        });
      }

      if (settings.snipePools?.enabled) {
        registerStrategy({
          id: `${user._id}_snipe_pool`,
          userId: user._id,
          type: STRATEGY_TYPES.SNIPE_POOL,
          config: settings.snipePools
        });
      }

      if (settings.takeProfit?.enabled) {
        registerStrategy({
          id: `${user._id}_take_profit`,
          userId: user._id,
          type: STRATEGY_TYPES.TAKE_PROFIT,
          config: settings.takeProfit
        });
      }

      if (settings.stopLoss?.enabled) {
        registerStrategy({
          id: `${user._id}_stop_loss`,
          userId: user._id,
          type: STRATEGY_TYPES.STOP_LOSS,
          config: settings.stopLoss
        });
      }
    }

    log.info(`Loaded ${activeStrategies.size} strategies from ${users.length} users`);

  } catch (error) {
    log.error('Error loading strategies:', error.message);
  }
};

// ------------------------------------
// Strategy Registration
// ------------------------------------

/**
 * Register a strategy
 */
const registerStrategy = (strategy) => {
  activeStrategies.set(strategy.id, {
    ...strategy,
    createdAt: new Date(),
    lastTriggered: null,
    triggerCount: 0
  });

  log.debug(`Strategy registered: ${strategy.id} (${strategy.type})`);
};

/**
 * Unregister a strategy
 */
const unregisterStrategy = (strategyId) => {
  activeStrategies.delete(strategyId);
  log.debug(`Strategy unregistered: ${strategyId}`);
};

// ------------------------------------
// Signal Handlers
// ------------------------------------

/**
 * Handle signal from user wallet tracker
 * Called when a tracked wallet performs an action
 */
export const handleUserWalletSignal = async (signal) => {
  if (!isRunning) return;

  const { walletAddress, signalType, data, userId: signalUserId } = signal;

  log.debug(`Processing signal: ${signalType} from ${walletAddress.slice(0, 8)}...`);

  // Find copy trade strategies that track this wallet
  for (const [strategyId, strategy] of activeStrategies.entries()) {
    if (strategy.type !== STRATEGY_TYPES.COPY_TRADE) continue;

    // Check if this strategy's user is tracking the wallet that generated the signal
    const user = await User.findById(strategy.userId);
    if (!user) continue;

    // Check if user has this wallet in their tracked wallets
    const UserWallet = (await import('../user-wallet-tracker/user-wallet.model.js')).default;
    const trackedWallet = await UserWallet.findOne({
      userId: strategy.userId,
      address: walletAddress,
      isActive: true
    });

    if (!trackedWallet) continue;

    // Execute copy trade
    await executeCopyTrade(strategy, signal, user);
  }
};

/**
 * Handle new mint detected from subwallet
 */
export const handleMintSignal = async (mintData) => {
  if (!isRunning) return;

  const { subwalletAddress, tokenMint, tokenSymbol, platform } = mintData;

  log.debug(`Processing mint signal: ${tokenSymbol} on ${platform}`);

  // Find snipe mint strategies
  for (const [strategyId, strategy] of activeStrategies.entries()) {
    if (strategy.type !== STRATEGY_TYPES.SNIPE_MINT) continue;

    await executeSnipeMint(strategy, mintData);
  }
};

/**
 * Handle new pool detected from subwallet
 */
export const handlePoolSignal = async (poolData) => {
  if (!isRunning) return;

  const { poolAddress, tokenMint, platform } = poolData;

  log.debug(`Processing pool signal: ${poolAddress.slice(0, 8)}... on ${platform}`);

  // Find snipe pool strategies
  for (const [strategyId, strategy] of activeStrategies.entries()) {
    if (strategy.type !== STRATEGY_TYPES.SNIPE_POOL) continue;

    await executeSnipePool(strategy, poolData);
  }
};

// ------------------------------------
// Strategy Execution
// ------------------------------------

/**
 * Execute copy trade strategy
 */
const executeCopyTrade = async (strategy, signal, user) => {
  const { signalType, data } = signal;
  const config = strategy.config;

  // Only copy buys (optionally sells)
  if (signalType !== 'buy' && !(signalType === 'sell' && config.copySells)) {
    return;
  }

  // Check cooldown
  const cooldownKey = `cooldown:${strategy.id}`;
  const inCooldown = await cache.exists(cooldownKey);
  if (inCooldown) {
    log.debug(`Strategy ${strategy.id} in cooldown`);
    return;
  }

  try {
    log.info(`Executing copy trade for user ${user.walletAddress.slice(0, 8)}...`);

    // Calculate amount based on config
    const tradeAmount = config.fixedAmount || (data.solSpent * (config.percentageOfTrade / 100));
    const finalAmount = Math.min(tradeAmount, config.maxAmountPerTrade || 1);

    // Execute the trade
    const result = await tradingService.executeTrade({
      userId: user._id.toString(),
      type: signalType,
      tokenMint: data.mint,
      amount: signalType === 'buy' ? finalAmount : data.amount,
      slippageBps: config.slippageBps || 100,
      priorityFee: config.priorityFee || 10000,
      preferredDex: 'auto'
    });

    // Set cooldown
    await cache.set(cooldownKey, '1', config.cooldownSeconds || 60);

    // Update strategy stats
    strategy.lastTriggered = new Date();
    strategy.triggerCount++;

    // Notify user
    wsEvents.emitNotification({
      type: 'auto_trade',
      strategy: 'copy_trade',
      success: result.success,
      message: result.success 
        ? `Copied ${signalType}: ${data.mint.slice(0, 8)}...`
        : `Copy trade failed: ${result.error}`,
      trade: result.trade
    }, user._id.toString());

    log.info(`Copy trade ${result.success ? 'succeeded' : 'failed'}: ${data.mint.slice(0, 8)}...`);

  } catch (error) {
    log.error(`Copy trade error: ${error.message}`);
  }
};

/**
 * Execute snipe mint strategy
 */
const executeSnipeMint = async (strategy, mintData) => {
  const config = strategy.config;
  const { tokenMint, tokenSymbol, platform, subwalletAddress } = mintData;

  // Check platform filter
  if (config.platforms && !config.platforms.includes(platform)) {
    return;
  }

  // Check cooldown
  const cooldownKey = `cooldown:${strategy.id}`;
  const inCooldown = await cache.exists(cooldownKey);
  if (inCooldown) {
    return;
  }

  // Check if already sniped this token
  const snipedKey = `sniped:${strategy.userId}:${tokenMint}`;
  const alreadySniped = await cache.exists(snipedKey);
  if (alreadySniped) {
    return;
  }

  try {
    const user = await User.findById(strategy.userId);
    if (!user) return;

    log.info(`Executing snipe mint for ${tokenSymbol} (${tokenMint.slice(0, 8)}...)`);

    const amount = config.amount || 0.1; // Default 0.1 SOL

    const result = await tradingService.buyToken({
      userId: user._id.toString(),
      tokenMint,
      solAmount: amount,
      slippageBps: config.slippageBps || 500, // Higher slippage for snipes
      priorityFee: config.priorityFee || 50000, // Higher priority for snipes
      preferredDex: 'auto'
    });

    // Mark as sniped (24 hour expiry)
    await cache.set(snipedKey, '1', 86400);

    // Set cooldown
    await cache.set(cooldownKey, '1', config.cooldownSeconds || 30);

    // Update strategy stats
    strategy.lastTriggered = new Date();
    strategy.triggerCount++;

    // Notify user
    wsEvents.emitNotification({
      type: 'auto_trade',
      strategy: 'snipe_mint',
      success: result.success,
      message: result.success 
        ? `Sniped mint: ${tokenSymbol} for ${amount} SOL`
        : `Snipe failed: ${result.error}`,
      trade: result.trade
    }, user._id.toString());

    log.info(`Snipe mint ${result.success ? 'succeeded' : 'failed'}: ${tokenSymbol}`);

  } catch (error) {
    log.error(`Snipe mint error: ${error.message}`);
  }
};

/**
 * Execute snipe pool strategy
 */
const executeSnipePool = async (strategy, poolData) => {
  const config = strategy.config;
  const { poolAddress, tokenMint, platform } = poolData;

  // Check platform filter
  if (config.platforms && !config.platforms.includes(platform)) {
    return;
  }

  // Check cooldown
  const cooldownKey = `cooldown:${strategy.id}`;
  const inCooldown = await cache.exists(cooldownKey);
  if (inCooldown) {
    return;
  }

  // Check if already sniped this pool
  const snipedKey = `sniped:${strategy.userId}:${poolAddress}`;
  const alreadySniped = await cache.exists(snipedKey);
  if (alreadySniped) {
    return;
  }

  try {
    const user = await User.findById(strategy.userId);
    if (!user) return;

    log.info(`Executing snipe pool for ${tokenMint.slice(0, 8)}...`);

    const amount = config.amount || 0.1;

    const result = await tradingService.buyToken({
      userId: user._id.toString(),
      tokenMint,
      solAmount: amount,
      slippageBps: config.slippageBps || 500,
      priorityFee: config.priorityFee || 50000,
      preferredDex: platform === 'raydium' ? 'raydium' : 'auto'
    });

    // Mark as sniped
    await cache.set(snipedKey, '1', 86400);

    // Set cooldown
    await cache.set(cooldownKey, '1', config.cooldownSeconds || 30);

    // Update strategy stats
    strategy.lastTriggered = new Date();
    strategy.triggerCount++;

    // Notify user
    wsEvents.emitNotification({
      type: 'auto_trade',
      strategy: 'snipe_pool',
      success: result.success,
      message: result.success 
        ? `Sniped pool: ${tokenMint.slice(0, 8)}... for ${amount} SOL`
        : `Pool snipe failed: ${result.error}`,
      trade: result.trade
    }, user._id.toString());

    log.info(`Snipe pool ${result.success ? 'succeeded' : 'failed'}: ${tokenMint.slice(0, 8)}...`);

  } catch (error) {
    log.error(`Snipe pool error: ${error.message}`);
  }
};

// ------------------------------------
// Take Profit / Stop Loss
// ------------------------------------

/**
 * Check and execute take profit / stop loss for a user's positions
 * Called periodically or on price updates
 */
export const checkExitStrategies = async (userId, tokenMint, currentPrice) => {
  if (!isRunning) return;

  // Find TP/SL strategies for this user
  const tpStrategy = activeStrategies.get(`${userId}_take_profit`);
  const slStrategy = activeStrategies.get(`${userId}_stop_loss`);

  if (!tpStrategy && !slStrategy) return;

  try {
    // Get user's position for this token
    const trades = await Trade.find({
      userId,
      tokenMint,
      type: 'buy',
      status: 'completed'
    }).sort({ createdAt: -1 });

    if (trades.length === 0) return;

    // Calculate average entry price
    const totalSpent = trades.reduce((sum, t) => sum + (t.inputAmount || 0), 0);
    const totalTokens = trades.reduce((sum, t) => sum + (t.actualOutputAmount || 0), 0);
    const avgEntryPrice = totalSpent / totalTokens;

    // Calculate current P&L percentage
    const pnlPercent = ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;

    // Check take profit
    if (tpStrategy && pnlPercent >= tpStrategy.config.targetPercent) {
      await executeExit(userId, tokenMint, totalTokens, 'take_profit', pnlPercent);
    }

    // Check stop loss
    if (slStrategy && pnlPercent <= -slStrategy.config.stopPercent) {
      await executeExit(userId, tokenMint, totalTokens, 'stop_loss', pnlPercent);
    }

  } catch (error) {
    log.error(`Exit strategy check error: ${error.message}`);
  }
};

/**
 * Execute exit (sell) for TP/SL
 */
const executeExit = async (userId, tokenMint, amount, reason, pnlPercent) => {
  try {
    log.info(`Executing ${reason} for ${tokenMint.slice(0, 8)}... (${pnlPercent.toFixed(2)}%)`);

    const result = await tradingService.sellToken({
      userId,
      tokenMint,
      tokenAmount: amount,
      slippageBps: 200,
      priorityFee: 20000,
      preferredDex: 'auto'
    });

    // Notify user
    wsEvents.emitNotification({
      type: 'auto_trade',
      strategy: reason,
      success: result.success,
      message: result.success 
        ? `${reason === 'take_profit' ? '🎉 Take Profit' : '🛑 Stop Loss'}: ${tokenMint.slice(0, 8)}... (${pnlPercent.toFixed(2)}%)`
        : `Exit failed: ${result.error}`,
      trade: result.trade
    }, userId);

    log.info(`${reason} ${result.success ? 'succeeded' : 'failed'}: ${tokenMint.slice(0, 8)}...`);

  } catch (error) {
    log.error(`Exit execution error: ${error.message}`);
  }
};

// ------------------------------------
// User Strategy Management
// ------------------------------------

/**
 * Update user's auto-trade settings
 */
export const updateUserStrategies = async (userId, settings) => {
  // Remove existing strategies for this user
  for (const [strategyId] of activeStrategies.entries()) {
    if (strategyId.startsWith(userId)) {
      unregisterStrategy(strategyId);
    }
  }

  // Re-register based on new settings
  if (settings.enabled) {
    if (settings.copyTrading?.enabled) {
      registerStrategy({
        id: `${userId}_copy_trade`,
        userId,
        type: STRATEGY_TYPES.COPY_TRADE,
        config: settings.copyTrading
      });
    }

    if (settings.snipeMints?.enabled) {
      registerStrategy({
        id: `${userId}_snipe_mint`,
        userId,
        type: STRATEGY_TYPES.SNIPE_MINT,
        config: settings.snipeMints
      });
    }

    if (settings.snipePools?.enabled) {
      registerStrategy({
        id: `${userId}_snipe_pool`,
        userId,
        type: STRATEGY_TYPES.SNIPE_POOL,
        config: settings.snipePools
      });
    }

    if (settings.takeProfit?.enabled) {
      registerStrategy({
        id: `${userId}_take_profit`,
        userId,
        type: STRATEGY_TYPES.TAKE_PROFIT,
        config: settings.takeProfit
      });
    }

    if (settings.stopLoss?.enabled) {
      registerStrategy({
        id: `${userId}_stop_loss`,
        userId,
        type: STRATEGY_TYPES.STOP_LOSS,
        config: settings.stopLoss
      });
    }
  }

  log.info(`Updated strategies for user ${userId}`);
};

// ------------------------------------
// Status & Stats
// ------------------------------------

/**
 * Get manager status
 */
export const getStatus = () => {
  return {
    isRunning,
    totalStrategies: activeStrategies.size,
    strategiesByType: getStrategiesByType()
  };
};

/**
 * Get strategies grouped by type
 */
const getStrategiesByType = () => {
  const byType = {};

  for (const [, strategy] of activeStrategies.entries()) {
    byType[strategy.type] = (byType[strategy.type] || 0) + 1;
  }

  return byType;
};

/**
 * Get user's active strategies
 */
export const getUserStrategies = (userId) => {
  const userStrategies = [];

  for (const [strategyId, strategy] of activeStrategies.entries()) {
    if (strategy.userId.toString() === userId) {
      userStrategies.push({
        id: strategyId,
        type: strategy.type,
        config: strategy.config,
        lastTriggered: strategy.lastTriggered,
        triggerCount: strategy.triggerCount
      });
    }
  }

  return userStrategies;
};

export default {
  start,
  stop,
  handleUserWalletSignal,
  handleMintSignal,
  handlePoolSignal,
  checkExitStrategies,
  updateUserStrategies,
  getStatus,
  getUserStrategies,
  STRATEGY_TYPES
};
