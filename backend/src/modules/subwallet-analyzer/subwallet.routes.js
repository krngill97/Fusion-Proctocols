// ===========================================
// Fusion - Subwallet Routes
// ===========================================

import { Router } from 'express';
import * as subwalletController from './subwallet.controller.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { validate, subwalletSchemas, commonSchemas } from '../../shared/utils/validators.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ------------------------------------
// Analyzer Control Routes
// ------------------------------------

/**
 * GET /api/subwallets/analyzer/status
 * Get analyzer status
 */
router.get('/analyzer/status', subwalletController.getAnalyzerStatus);

/**
 * POST /api/subwallets/analyzer/start
 * Start the analyzer
 */
router.post('/analyzer/start', subwalletController.startAnalyzer);

/**
 * POST /api/subwallets/analyzer/stop
 * Stop the analyzer
 */
router.post('/analyzer/stop', subwalletController.stopAnalyzer);

// ------------------------------------
// Stats & Special Queries
// ------------------------------------

/**
 * GET /api/subwallets/stats
 * Get statistics
 */
router.get('/stats', subwalletController.getStats);

/**
 * GET /api/subwallets/mints/recent
 * Get recent mints
 */
router.get('/mints/recent', subwalletController.getRecentMints);

/**
 * GET /api/subwallets/active
 * Get active subwallets
 */
router.get('/active', subwalletController.getActive);

/**
 * GET /api/subwallets/watching
 * Get watching subwallets
 */
router.get('/watching', subwalletController.getWatching);

/**
 * GET /api/subwallets/by-hot-wallet/:hotWalletId
 * Get subwallets by hot wallet
 */
router.get('/by-hot-wallet/:hotWalletId', subwalletController.getByHotWallet);

/**
 * GET /api/subwallets/address/:address
 * Get subwallet by address
 */
router.get('/address/:address', subwalletController.getByAddress);

// ------------------------------------
// CRUD Routes
// ------------------------------------

/**
 * GET /api/subwallets
 * Get all subwallets
 */
router.get(
  '/',
  validate(subwalletSchemas.list),
  subwalletController.getAll
);

/**
 * POST /api/subwallets
 * Manually add a subwallet
 */
router.post('/', subwalletController.addSubwallet);

/**
 * GET /api/subwallets/:id
 * Get subwallet by ID
 */
router.get(
  '/:id',
  validate(commonSchemas.idParam),
  subwalletController.getById
);

/**
 * PATCH /api/subwallets/:id/extend
 * Extend watch time
 */
router.patch(
  '/:id/extend',
  validate(commonSchemas.idParam),
  subwalletController.extendWatchTime
);

/**
 * GET /api/subwallets/:id/mints
 * Get mints for subwallet
 */
router.get(
  '/:id/mints',
  validate(commonSchemas.idParam),
  subwalletController.getMints
);

/**
 * GET /api/subwallets/:id/pools
 * Get pools for subwallet
 */
router.get(
  '/:id/pools',
  validate(commonSchemas.idParam),
  subwalletController.getPools
);

/**
 * GET /api/subwallets/:id/buys
 * Get buys for subwallet
 */
router.get(
  '/:id/buys',
  validate(commonSchemas.idParam),
  subwalletController.getBuys
);

export default router;
