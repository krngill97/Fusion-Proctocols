// ===========================================
// Fusion - User Wallet Routes
// ===========================================

import { Router } from 'express';
import * as userWalletController from './user-wallet.controller.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { validate, userWalletSchemas, commonSchemas } from '../../shared/utils/validators.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ------------------------------------
// Tracker Control Routes
// ------------------------------------

/**
 * GET /api/user-wallets/tracker/status
 * Get tracker status
 */
router.get('/tracker/status', userWalletController.getTrackerStatus);

/**
 * POST /api/user-wallets/tracker/start
 * Start the tracker
 */
router.post('/tracker/start', userWalletController.startTracker);

/**
 * POST /api/user-wallets/tracker/stop
 * Stop the tracker
 */
router.post('/tracker/stop', userWalletController.stopTracker);

// ------------------------------------
// Stats & Signals Routes
// ------------------------------------

/**
 * GET /api/user-wallets/stats
 * Get user stats
 */
router.get('/stats', userWalletController.getStats);

/**
 * GET /api/user-wallets/signals/all
 * Get all recent signals
 */
router.get('/signals/all', userWalletController.getAllSignals);

// ------------------------------------
// Import Routes
// ------------------------------------

/**
 * POST /api/user-wallets/import/subwallet
 * Import from subwallet
 */
router.post('/import/subwallet', userWalletController.importFromSubwallet);

// ------------------------------------
// Bulk Operations
// ------------------------------------

/**
 * POST /api/user-wallets/bulk
 * Bulk add wallets
 */
router.post('/bulk', userWalletController.bulkAdd);

// ------------------------------------
// CRUD Routes
// ------------------------------------

/**
 * GET /api/user-wallets
 * Get all wallets
 */
router.get(
  '/',
  validate(userWalletSchemas.list),
  userWalletController.getAll
);

/**
 * POST /api/user-wallets
 * Add a new wallet
 */
router.post(
  '/',
  validate(userWalletSchemas.add),
  userWalletController.add
);

/**
 * GET /api/user-wallets/:id
 * Get wallet by ID
 */
router.get(
  '/:id',
  validate(commonSchemas.idParam),
  userWalletController.getById
);

/**
 * PATCH /api/user-wallets/:id
 * Update wallet
 */
router.patch(
  '/:id',
  validate(commonSchemas.idParam),
  validate(userWalletSchemas.update),
  userWalletController.update
);

/**
 * DELETE /api/user-wallets/:id
 * Remove wallet
 */
router.delete(
  '/:id',
  validate(commonSchemas.idParam),
  userWalletController.remove
);

/**
 * PATCH /api/user-wallets/:id/toggle
 * Toggle wallet active status
 */
router.patch(
  '/:id/toggle',
  validate(commonSchemas.idParam),
  userWalletController.toggle
);

/**
 * GET /api/user-wallets/:id/signals
 * Get signals for a wallet
 */
router.get(
  '/:id/signals',
  validate(commonSchemas.idParam),
  userWalletController.getSignals
);

export default router;
