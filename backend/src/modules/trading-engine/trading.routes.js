// ===========================================
// Fusion - Trading Routes
// ===========================================

import { Router } from 'express';
import * as tradingController from './trading.controller.js';
import autoTradeRoutes from './auto-trade.routes.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { validate, tradingSchemas, commonSchemas } from '../../shared/utils/validators.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ------------------------------------
// Auto-Trade Sub-Routes
// ------------------------------------

router.use('/auto', autoTradeRoutes);

// ------------------------------------
// Quote & Simulation Routes
// ------------------------------------

/**
 * POST /api/trading/quote
 * Get a swap quote
 */
router.post(
  '/quote',
  validate(tradingSchemas.quote),
  tradingController.getQuote
);

/**
 * POST /api/trading/simulate
 * Simulate a trade
 */
router.post(
  '/simulate',
  validate(tradingSchemas.quote),
  tradingController.simulateTrade
);

// ------------------------------------
// Trade Execution Routes
// ------------------------------------

/**
 * POST /api/trading/buy
 * Execute a buy trade
 */
router.post(
  '/buy',
  validate(tradingSchemas.buy),
  tradingController.buyToken
);

/**
 * POST /api/trading/sell
 * Execute a sell trade
 */
router.post(
  '/sell',
  validate(tradingSchemas.sell),
  tradingController.sellToken
);

// ------------------------------------
// History & Stats Routes
// ------------------------------------

/**
 * GET /api/trading/history
 * Get trade history
 */
router.get(
  '/history',
  validate(tradingSchemas.history),
  tradingController.getHistory
);

/**
 * GET /api/trading/stats
 * Get trading stats
 */
router.get('/stats', tradingController.getStats);

// ------------------------------------
// Token Info Routes
// ------------------------------------

/**
 * GET /api/trading/price/:tokenMint
 * Get token price
 */
router.get('/price/:tokenMint', tradingController.getTokenPrice);

/**
 * GET /api/trading/token/:tokenMint
 * Get token info
 */
router.get('/token/:tokenMint', tradingController.getTokenInfo);

/**
 * GET /api/trading/pools/:tokenMint
 * Search pools for token
 */
router.get('/pools/:tokenMint', tradingController.searchPools);

// ------------------------------------
// Trade Management Routes
// ------------------------------------

/**
 * GET /api/trading/trades/:id
 * Get trade by ID
 */
router.get(
  '/trades/:id',
  validate(commonSchemas.idParam),
  tradingController.getTradeById
);

/**
 * POST /api/trading/trades/:id/cancel
 * Cancel a trade
 */
router.post(
  '/trades/:id/cancel',
  validate(commonSchemas.idParam),
  tradingController.cancelTrade
);

export default router;
