// ===========================================
// Fusion - Authentication Controller
// ===========================================

import { asyncHandler } from '../../shared/middleware/error-handler.middleware.js';
import * as authService from './auth.service.js';
import { logger } from '../../shared/utils/logger.js';

const log = logger.withContext('AuthController');

// ------------------------------------
// Get Nonce
// ------------------------------------

/**
 * GET /api/auth/nonce
 * Get a nonce for wallet signature verification
 */
export const getNonce = asyncHandler(async (req, res) => {
  const { walletAddress } = req.query;
  
  if (!walletAddress) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_WALLET',
        message: 'Wallet address is required'
      }
    });
  }
  
  const result = await authService.generateNonce(walletAddress);
  
  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Verify Signature & Login
// ------------------------------------

/**
 * POST /api/auth/verify
 * Verify wallet signature and authenticate user
 */
export const verifyAndLogin = asyncHandler(async (req, res) => {
  const { walletAddress, signature, message, nonce } = req.body;
  
  // Validate required fields
  if (!walletAddress || !signature || !message || !nonce) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'walletAddress, signature, message, and nonce are required'
      }
    });
  }
  
  const result = await authService.authenticate(
    walletAddress,
    signature,
    message,
    nonce
  );
  
  log.info(`User authenticated: ${walletAddress.slice(0, 8)}...`);
  
  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Refresh Token
// ------------------------------------

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Refresh token is required'
      }
    });
  }
  
  const result = await authService.refreshAccessToken(refreshToken);
  
  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Logout
// ------------------------------------

/**
 * POST /api/auth/logout
 * Logout user and invalidate refresh token
 */
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (req.user && refreshToken) {
    await authService.logout(req.user.id, refreshToken);
  }
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// ------------------------------------
// Get Current User
// ------------------------------------

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  
  res.json({
    success: true,
    data: {
      id: user._id,
      walletAddress: user.walletAddress,
      preferences: user.preferences,
      autoTradeSettings: user.autoTradeSettings,
      tradingWallets: user.tradingWallets.map(w => ({
        id: w._id,
        publicKey: w.publicKey,
        label: w.label,
        isDefault: w.isDefault,
        createdAt: w.createdAt
      })),
      stats: user.stats,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }
  });
});

// ------------------------------------
// Update Preferences
// ------------------------------------

/**
 * PATCH /api/auth/preferences
 * Update user preferences
 */
export const updatePreferences = asyncHandler(async (req, res) => {
  const { theme, defaultSlippage, defaultPriorityFee, notifications } = req.body;
  
  const user = await authService.getCurrentUser(req.user.id);
  
  // Update only provided fields
  if (theme !== undefined) {
    user.preferences.theme = theme;
  }
  if (defaultSlippage !== undefined) {
    user.preferences.defaultSlippage = defaultSlippage;
  }
  if (defaultPriorityFee !== undefined) {
    user.preferences.defaultPriorityFee = defaultPriorityFee;
  }
  if (notifications !== undefined) {
    user.preferences.notifications = {
      ...user.preferences.notifications,
      ...notifications
    };
  }
  
  await user.save();
  
  log.info(`Preferences updated for user: ${user.walletAddress.slice(0, 8)}...`);
  
  res.json({
    success: true,
    data: {
      preferences: user.preferences
    }
  });
});

// ------------------------------------
// Update Auto Trade Settings
// ------------------------------------

/**
 * PATCH /api/auth/auto-trade-settings
 * Update auto trade settings
 */
export const updateAutoTradeSettings = asyncHandler(async (req, res) => {
  const {
    enabled,
    maxSolPerTrade,
    takeProfitPercent,
    stopLossPercent,
    enabledTriggers,
    slippageBps,
    priorityFee,
    preferredDex
  } = req.body;
  
  const user = await authService.getCurrentUser(req.user.id);
  
  // Update only provided fields
  if (enabled !== undefined) {
    user.autoTradeSettings.enabled = enabled;
  }
  if (maxSolPerTrade !== undefined) {
    user.autoTradeSettings.maxSolPerTrade = maxSolPerTrade;
  }
  if (takeProfitPercent !== undefined) {
    user.autoTradeSettings.takeProfitPercent = takeProfitPercent;
  }
  if (stopLossPercent !== undefined) {
    user.autoTradeSettings.stopLossPercent = stopLossPercent;
  }
  if (enabledTriggers !== undefined) {
    user.autoTradeSettings.enabledTriggers = enabledTriggers;
  }
  if (slippageBps !== undefined) {
    user.autoTradeSettings.slippageBps = slippageBps;
  }
  if (priorityFee !== undefined) {
    user.autoTradeSettings.priorityFee = priorityFee;
  }
  if (preferredDex !== undefined) {
    user.autoTradeSettings.preferredDex = preferredDex;
  }
  
  await user.save();
  
  log.info(`Auto trade settings updated for user: ${user.walletAddress.slice(0, 8)}...`);
  
  res.json({
    success: true,
    data: {
      autoTradeSettings: user.autoTradeSettings
    }
  });
});

// ------------------------------------
// Add Trading Wallet
// ------------------------------------

/**
 * POST /api/auth/trading-wallets
 * Add a new trading wallet
 */
export const addTradingWallet = asyncHandler(async (req, res) => {
  const { privateKey, label } = req.body;
  
  if (!privateKey) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PRIVATE_KEY',
        message: 'Private key is required'
      }
    });
  }
  
  const user = await authService.getCurrentUser(req.user.id);
  
  // Import and validate keypair
  const { importKeypair } = await import('../../shared/services/solana.service.js');
  const { encryptPrivateKey } = await import('../../shared/services/encryption.service.js');
  
  let keypairData;
  try {
    keypairData = importKeypair(privateKey);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PRIVATE_KEY',
        message: 'Invalid private key format'
      }
    });
  }
  
  // Encrypt the private key
  const encryptedKey = encryptPrivateKey(keypairData.privateKey, user.walletAddress);
  
  // Add to user's trading wallets
  await user.addTradingWallet(
    keypairData.publicKey,
    encryptedKey,
    label
  );
  
  log.info(`Trading wallet added for user: ${user.walletAddress.slice(0, 8)}...`);
  
  res.status(201).json({
    success: true,
    data: {
      publicKey: keypairData.publicKey,
      label: label || `Wallet ${user.tradingWallets.length}`,
      isDefault: user.tradingWallets.length === 1
    }
  });
});

// ------------------------------------
// Remove Trading Wallet
// ------------------------------------

/**
 * DELETE /api/auth/trading-wallets/:walletId
 * Remove a trading wallet
 */
export const removeTradingWallet = asyncHandler(async (req, res) => {
  const { walletId } = req.params;
  
  const user = await authService.getCurrentUser(req.user.id);
  
  await user.removeTradingWallet(walletId);
  
  log.info(`Trading wallet removed for user: ${user.walletAddress.slice(0, 8)}...`);
  
  res.json({
    success: true,
    message: 'Trading wallet removed'
  });
});

// ------------------------------------
// Set Default Trading Wallet
// ------------------------------------

/**
 * PATCH /api/auth/trading-wallets/:walletId/default
 * Set a trading wallet as default
 */
export const setDefaultWallet = asyncHandler(async (req, res) => {
  const { walletId } = req.params;
  
  const user = await authService.getCurrentUser(req.user.id);
  
  await user.setDefaultWallet(walletId);
  
  log.info(`Default wallet set for user: ${user.walletAddress.slice(0, 8)}...`);
  
  res.json({
    success: true,
    message: 'Default wallet updated'
  });
});

// ------------------------------------
// Generate New Trading Wallet
// ------------------------------------

/**
 * POST /api/auth/trading-wallets/generate
 * Generate a new trading wallet
 */
export const generateTradingWallet = asyncHandler(async (req, res) => {
  const { label } = req.body;
  
  const user = await authService.getCurrentUser(req.user.id);
  
  // Generate new keypair
  const { generateKeypair } = await import('../../shared/services/solana.service.js');
  const { encryptPrivateKey } = await import('../../shared/services/encryption.service.js');
  
  const keypairData = generateKeypair();
  
  // Encrypt the private key
  const encryptedKey = encryptPrivateKey(keypairData.privateKey, user.walletAddress);
  
  // Add to user's trading wallets
  await user.addTradingWallet(
    keypairData.publicKey,
    encryptedKey,
    label || `Generated Wallet ${user.tradingWallets.length + 1}`
  );
  
  log.info(`Trading wallet generated for user: ${user.walletAddress.slice(0, 8)}...`);
  
  res.status(201).json({
    success: true,
    data: {
      publicKey: keypairData.publicKey,
      privateKey: keypairData.privateKey, // Return once for user to backup
      label: label || `Generated Wallet ${user.tradingWallets.length}`,
      isDefault: user.tradingWallets.length === 1,
      warning: 'Save this private key securely. It will not be shown again.'
    }
  });
});

export default {
  getNonce,
  verifyAndLogin,
  refreshToken,
  logout,
  getMe,
  updatePreferences,
  updateAutoTradeSettings,
  addTradingWallet,
  removeTradingWallet,
  setDefaultWallet,
  generateTradingWallet
};
