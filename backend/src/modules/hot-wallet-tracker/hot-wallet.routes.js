// ===========================================
// Fusion - Hot Wallet Routes
// ===========================================

import { Router } from 'express';
import * as hotWalletController from './hot-wallet.controller.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { validate, hotWalletSchemas, commonSchemas } from '../../shared/utils/validators.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ------------------------------------
// Tracker Control Routes
// ------------------------------------

/**
 * GET /api/hot-wallets/tracker/status
 * Get tracker status
 */
router.get('/tracker/status', hotWalletController.getTrackerStatus);

/**
 * POST /api/hot-wallets/tracker/start
 * Start the tracker
 */
router.post('/tracker/start', hotWalletController.startTracker);

/**
 * POST /api/hot-wallets/tracker/stop
 * Stop the tracker
 */
router.post('/tracker/stop', hotWalletController.stopTracker);

// ------------------------------------
// Stats & Transfers Routes
// ------------------------------------

/**
 * GET /api/hot-wallets/stats
 * Get aggregated stats
 */
router.get('/stats', hotWalletController.getStats);

/**
 * GET /api/hot-wallets/transfers
 * Get recent transfers
 */
router.get('/transfers', hotWalletController.getTransfers);

// ------------------------------------
// Bulk Operations
// ------------------------------------

/**
 * POST /api/hot-wallets/bulk
 * Bulk add hot wallets
 */
router.post('/bulk', hotWalletController.bulkAdd);

// ------------------------------------
// CRUD Routes
// ------------------------------------

/**
 * GET /api/hot-wallets
 * Get all hot wallets
 */
router.get(
  '/',
  validate(hotWalletSchemas.list),
  hotWalletController.getAll
);

/**
 * POST /api/hot-wallets
 * Add a new hot wallet
 */
router.post(
  '/',
  validate(hotWalletSchemas.add),
  hotWalletController.add
);

/**
 * GET /api/hot-wallets/:id
 * Get a single hot wallet
 */
router.get(
  '/:id',
  validate(commonSchemas.idParam),
  hotWalletController.getById
);

/**
 * PATCH /api/hot-wallets/:id
 * Update a hot wallet
 */
router.patch(
  '/:id',
  validate(commonSchemas.idParam),
  validate(hotWalletSchemas.update),
  hotWalletController.update
);

/**
 * DELETE /api/hot-wallets/:id
 * Remove a hot wallet
 */
router.delete(
  '/:id',
  validate(commonSchemas.idParam),
  hotWalletController.remove
);

/**
 * PATCH /api/hot-wallets/:id/toggle
 * Toggle hot wallet active status
 */
router.patch(
  '/:id/toggle',
  validate(commonSchemas.idParam),
  hotWalletController.toggle
);

/**
 * GET /api/hot-wallets/:id/transfers
 * Get transfers for a specific hot wallet
 */
router.get(
  '/:id/transfers',
  validate(commonSchemas.idParam),
  hotWalletController.getTransfersByWallet
);

export default router;
