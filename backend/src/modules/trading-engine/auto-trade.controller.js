// ===========================================
// Fusion - Auto-Trade Controller
// ===========================================

import { asyncHandler } from '../../shared/middleware/error-handler.middleware.js';
import * as autoTradeService from './auto-trade.service.js';
import User from '../auth/auth.model.js';
import { logger } from '../../shared/utils/logger.js';

const log = logger.withContext('AutoTradeController');

// ------------------------------------
// Get Auto-Trade Status
// ------------------------------------

/**
 * GET /api/trading/auto/status
 * Get auto-trade manager status
 */
export const getStatus = asyncHandler(async (req, res) => {
  const status = autoTradeService.getStatus();

  res.json({
    success: true,
    data: status
  });
});

// ------------------------------------
// Get User Strategies
// ------------------------------------

/**
 * GET /api/trading/auto/strategies
 * Get user's active strategies
 */
export const getUserStrategies = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const strategies = autoTradeService.getUserStrategies(userId);

  res.json({
    success: true,
    data: {
      strategies,
      count: strategies.length
    }
  });
});

// ------------------------------------
// Get User Settings
// ------------------------------------

/**
 * GET /api/trading/auto/settings
 * Get user's auto-trade settings
 */
export const getSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await User.findById(userId);

  res.json({
    success: true,
    data: user.autoTradeSettings || {
      enabled: false,
      copyTrading: { enabled: false },
      snipeMints: { enabled: false },
      snipePools: { enabled: false },
      takeProfit: { enabled: false },
      stopLoss: { enabled: false }
    }
  });
});

// ------------------------------------
// Update Settings
// ------------------------------------

/**
 * PATCH /api/trading/auto/settings
 * Update auto-trade settings
 */
export const updateSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const updates = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      }
    });
  }

  // Merge updates with existing settings
  user.autoTradeSettings = {
    ...user.autoTradeSettings,
    ...updates
  };

  await user.save();

  // Update active strategies
  await autoTradeService.updateUserStrategies(userId, user.autoTradeSettings);

  log.info(`Auto-trade settings updated for user ${user.walletAddress.slice(0, 8)}...`);

  res.json({
    success: true,
    data: user.autoTradeSettings
  });
});

// ------------------------------------
// Enable/Disable Auto-Trade
// ------------------------------------

/**
 * POST /api/trading/auto/enable
 * Enable auto-trading
 */
export const enable = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await User.findById(userId);

  if (!user.autoTradeSettings) {
    user.autoTradeSettings = {};
  }

  user.autoTradeSettings.enabled = true;
  await user.save();

  // Update strategies
  await autoTradeService.updateUserStrategies(userId, user.autoTradeSettings);

  res.json({
    success: true,
    message: 'Auto-trading enabled'
  });
});

/**
 * POST /api/trading/auto/disable
 * Disable auto-trading
 */
export const disable = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await User.findById(userId);

  if (user.autoTradeSettings) {
    user.autoTradeSettings.enabled = false;
    await user.save();
  }

  // Remove user's strategies
  await autoTradeService.updateUserStrategies(userId, { enabled: false });

  res.json({
    success: true,
    message: 'Auto-trading disabled'
  });
});

// ------------------------------------
// Copy Trading Settings
// ------------------------------------

/**
 * PATCH /api/trading/auto/copy-trading
 * Update copy trading settings
 */
export const updateCopyTrading = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { enabled, fixedAmount, percentageOfTrade, maxAmountPerTrade, copySells, slippageBps, priorityFee, cooldownSeconds } = req.body;

  const user = await User.findById(userId);

  if (!user.autoTradeSettings) {
    user.autoTradeSettings = {};
  }

  user.autoTradeSettings.copyTrading = {
    enabled: enabled ?? false,
    fixedAmount,
    percentageOfTrade: percentageOfTrade || 100,
    maxAmountPerTrade: maxAmountPerTrade || 1,
    copySells: copySells ?? false,
    slippageBps: slippageBps || 100,
    priorityFee: priorityFee || 10000,
    cooldownSeconds: cooldownSeconds || 60
  };

  await user.save();

  // Update strategies
  await autoTradeService.updateUserStrategies(userId, user.autoTradeSettings);

  res.json({
    success: true,
    data: user.autoTradeSettings.copyTrading
  });
});

// ------------------------------------
// Snipe Mints Settings
// ------------------------------------

/**
 * PATCH /api/trading/auto/snipe-mints
 * Update snipe mints settings
 */
export const updateSnipeMints = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { enabled, amount, platforms, slippageBps, priorityFee, cooldownSeconds } = req.body;

  const user = await User.findById(userId);

  if (!user.autoTradeSettings) {
    user.autoTradeSettings = {};
  }

  user.autoTradeSettings.snipeMints = {
    enabled: enabled ?? false,
    amount: amount || 0.1,
    platforms: platforms || ['pump.fun'],
    slippageBps: slippageBps || 500,
    priorityFee: priorityFee || 50000,
    cooldownSeconds: cooldownSeconds || 30
  };

  await user.save();

  // Update strategies
  await autoTradeService.updateUserStrategies(userId, user.autoTradeSettings);

  res.json({
    success: true,
    data: user.autoTradeSettings.snipeMints
  });
});

// ------------------------------------
// Snipe Pools Settings
// ------------------------------------

/**
 * PATCH /api/trading/auto/snipe-pools
 * Update snipe pools settings
 */
export const updateSnipePools = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { enabled, amount, platforms, slippageBps, priorityFee, cooldownSeconds } = req.body;

  const user = await User.findById(userId);

  if (!user.autoTradeSettings) {
    user.autoTradeSettings = {};
  }

  user.autoTradeSettings.snipePools = {
    enabled: enabled ?? false,
    amount: amount || 0.1,
    platforms: platforms || ['raydium'],
    slippageBps: slippageBps || 500,
    priorityFee: priorityFee || 50000,
    cooldownSeconds: cooldownSeconds || 30
  };

  await user.save();

  // Update strategies
  await autoTradeService.updateUserStrategies(userId, user.autoTradeSettings);

  res.json({
    success: true,
    data: user.autoTradeSettings.snipePools
  });
});

// ------------------------------------
// Take Profit Settings
// ------------------------------------

/**
 * PATCH /api/trading/auto/take-profit
 * Update take profit settings
 */
export const updateTakeProfit = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { enabled, targetPercent, sellPercent } = req.body;

  const user = await User.findById(userId);

  if (!user.autoTradeSettings) {
    user.autoTradeSettings = {};
  }

  user.autoTradeSettings.takeProfit = {
    enabled: enabled ?? false,
    targetPercent: targetPercent || 50, // Default 50% profit
    sellPercent: sellPercent || 100 // Sell 100% of position
  };

  await user.save();

  // Update strategies
  await autoTradeService.updateUserStrategies(userId, user.autoTradeSettings);

  res.json({
    success: true,
    data: user.autoTradeSettings.takeProfit
  });
});

// ------------------------------------
// Stop Loss Settings
// ------------------------------------

/**
 * PATCH /api/trading/auto/stop-loss
 * Update stop loss settings
 */
export const updateStopLoss = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { enabled, stopPercent, sellPercent } = req.body;

  const user = await User.findById(userId);

  if (!user.autoTradeSettings) {
    user.autoTradeSettings = {};
  }

  user.autoTradeSettings.stopLoss = {
    enabled: enabled ?? false,
    stopPercent: stopPercent || 20, // Default 20% loss
    sellPercent: sellPercent || 100 // Sell 100% of position
  };

  await user.save();

  // Update strategies
  await autoTradeService.updateUserStrategies(userId, user.autoTradeSettings);

  res.json({
    success: true,
    data: user.autoTradeSettings.stopLoss
  });
});

// ------------------------------------
// Start/Stop Manager (Admin)
// ------------------------------------

/**
 * POST /api/trading/auto/manager/start
 * Start the auto-trade manager
 */
export const startManager = asyncHandler(async (req, res) => {
  await autoTradeService.start();

  res.json({
    success: true,
    message: 'Auto-trade manager started'
  });
});

/**
 * POST /api/trading/auto/manager/stop
 * Stop the auto-trade manager
 */
export const stopManager = asyncHandler(async (req, res) => {
  await autoTradeService.stop();

  res.json({
    success: true,
    message: 'Auto-trade manager stopped'
  });
});

export default {
  getStatus,
  getUserStrategies,
  getSettings,
  updateSettings,
  enable,
  disable,
  updateCopyTrading,
  updateSnipeMints,
  updateSnipePools,
  updateTakeProfit,
  updateStopLoss,
  startManager,
  stopManager
};
