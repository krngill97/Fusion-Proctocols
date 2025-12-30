// ===========================================
// Fusion - Auto-Trade Routes
// ===========================================

import { Router } from 'express';
import * as autoTradeController from './auto-trade.controller.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ------------------------------------
// Status & Strategies
// ------------------------------------

/**
 * GET /api/trading/auto/status
 * Get manager status
 */
router.get('/status', autoTradeController.getStatus);

/**
 * GET /api/trading/auto/strategies
 * Get user's active strategies
 */
router.get('/strategies', autoTradeController.getUserStrategies);

// ------------------------------------
// User Settings
// ------------------------------------

/**
 * GET /api/trading/auto/settings
 * Get user's settings
 */
router.get('/settings', autoTradeController.getSettings);

/**
 * PATCH /api/trading/auto/settings
 * Update all settings
 */
router.patch('/settings', autoTradeController.updateSettings);

// ------------------------------------
// Enable/Disable
// ------------------------------------

/**
 * POST /api/trading/auto/enable
 * Enable auto-trading
 */
router.post('/enable', autoTradeController.enable);

/**
 * POST /api/trading/auto/disable
 * Disable auto-trading
 */
router.post('/disable', autoTradeController.disable);

// ------------------------------------
// Individual Strategy Settings
// ------------------------------------

/**
 * PATCH /api/trading/auto/copy-trading
 * Update copy trading
 */
router.patch('/copy-trading', autoTradeController.updateCopyTrading);

/**
 * PATCH /api/trading/auto/snipe-mints
 * Update snipe mints
 */
router.patch('/snipe-mints', autoTradeController.updateSnipeMints);

/**
 * PATCH /api/trading/auto/snipe-pools
 * Update snipe pools
 */
router.patch('/snipe-pools', autoTradeController.updateSnipePools);

/**
 * PATCH /api/trading/auto/take-profit
 * Update take profit
 */
router.patch('/take-profit', autoTradeController.updateTakeProfit);

/**
 * PATCH /api/trading/auto/stop-loss
 * Update stop loss
 */
router.patch('/stop-loss', autoTradeController.updateStopLoss);

// ------------------------------------
// Manager Control
// ------------------------------------

/**
 * POST /api/trading/auto/manager/start
 * Start manager
 */
router.post('/manager/start', autoTradeController.startManager);

/**
 * POST /api/trading/auto/manager/stop
 * Stop manager
 */
router.post('/manager/stop', autoTradeController.stopManager);

export default router;
