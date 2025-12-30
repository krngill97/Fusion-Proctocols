// ===========================================
// Fusion - Authentication Routes
// ===========================================

import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { authLimiter } from '../../shared/middleware/rate-limiter.middleware.js';
import { validate, authSchemas, preferencesSchemas, tradingSchemas } from '../../shared/utils/validators.js';

const router = Router();

// ------------------------------------
// Public Routes (No Auth Required)
// ------------------------------------

/**
 * GET /api/auth/nonce
 * Get a nonce for wallet signature verification
 * Query: walletAddress
 */
router.get('/nonce', authLimiter, authController.getNonce);

/**
 * POST /api/auth/verify
 * Verify wallet signature and authenticate user
 * Body: { walletAddress, signature, message, nonce }
 */
router.post(
  '/verify',
  authLimiter,
  validate(authSchemas.verifySignature),
  authController.verifyAndLogin
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * Body: { refreshToken }
 */
router.post(
  '/refresh',
  validate(authSchemas.refreshToken),
  authController.refreshToken
);

// ------------------------------------
// Protected Routes (Auth Required)
// ------------------------------------

/**
 * POST /api/auth/logout
 * Logout user and invalidate refresh token
 * Body: { refreshToken }
 */
router.post('/logout', authenticate, authController.logout);

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, authController.getMe);

/**
 * PATCH /api/auth/preferences
 * Update user preferences
 * Body: { theme?, defaultSlippage?, defaultPriorityFee?, notifications? }
 */
router.patch(
  '/preferences',
  authenticate,
  validate(preferencesSchemas.update),
  authController.updatePreferences
);

/**
 * PATCH /api/auth/auto-trade-settings
 * Update auto trade settings
 * Body: { enabled?, maxSolPerTrade?, takeProfitPercent?, ... }
 */
router.patch(
  '/auto-trade-settings',
  authenticate,
  validate(tradingSchemas.autoTradeSettings),
  authController.updateAutoTradeSettings
);

// ------------------------------------
// Trading Wallet Routes
// ------------------------------------

/**
 * POST /api/auth/trading-wallets
 * Add a new trading wallet
 * Body: { privateKey, label? }
 */
router.post(
  '/trading-wallets',
  authenticate,
  validate(tradingSchemas.addTradingWallet),
  authController.addTradingWallet
);

/**
 * POST /api/auth/trading-wallets/generate
 * Generate a new trading wallet
 * Body: { label? }
 */
router.post(
  '/trading-wallets/generate',
  authenticate,
  authController.generateTradingWallet
);

/**
 * DELETE /api/auth/trading-wallets/:walletId
 * Remove a trading wallet
 */
router.delete(
  '/trading-wallets/:walletId',
  authenticate,
  authController.removeTradingWallet
);

/**
 * PATCH /api/auth/trading-wallets/:walletId/default
 * Set a trading wallet as default
 */
router.patch(
  '/trading-wallets/:walletId/default',
  authenticate,
  authController.setDefaultWallet
);

export default router;
