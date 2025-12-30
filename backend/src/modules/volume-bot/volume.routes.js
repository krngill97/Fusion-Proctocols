// ===========================================
// Fusion - Volume Bot Routes
// ===========================================

import { Router } from 'express';
import * as volumeController from './volume.controller.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { validate, volumeSchemas, commonSchemas } from '../../shared/utils/validators.js';

const router = Router();

// ------------------------------------
// Admin Routes (No Auth Required)
// ------------------------------------

/**
 * DELETE /api/volume/sessions/admin/clear-all
 * Clear all volume sessions (admin only)
 */
router.delete('/sessions/admin/clear-all', volumeController.clearAllSessions);

// All other routes require authentication
router.use(authenticate);

// ------------------------------------
// Status Routes
// ------------------------------------

/**
 * GET /api/volume/status
 * Get volume bot status
 */
router.get('/status', volumeController.getStatus);

/**
 * GET /api/volume/active-count
 * Get active sessions count
 */
router.get('/active-count', volumeController.getActiveCount);

// ------------------------------------
// Session CRUD Routes
// ------------------------------------

/**
 * GET /api/volume/sessions
 * Get user's sessions
 */
router.get(
  '/sessions',
  validate(volumeSchemas.list, 'query'),
  volumeController.getUserSessions
);

/**
 * POST /api/volume/sessions
 * Create a new session
 */
router.post(
  '/sessions',
  validate(volumeSchemas.create),
  volumeController.createSession
);

/**
 * GET /api/volume/sessions/:id
 * Get session details
 */
router.get(
  '/sessions/:id',
  validate(commonSchemas.idParam, 'params'),
  volumeController.getSession
);

// ------------------------------------
// Session Control Routes
// ------------------------------------

/**
 * POST /api/volume/sessions/:id/start
 * Start a session
 */
router.post(
  '/sessions/:id/start',
  validate(commonSchemas.idParam, 'params'),
  volumeController.startSession
);

/**
 * POST /api/volume/sessions/:id/pause
 * Pause a session
 */
router.post(
  '/sessions/:id/pause',
  validate(commonSchemas.idParam, 'params'),
  volumeController.pauseSession
);

/**
 * POST /api/volume/sessions/:id/resume
 * Resume a session
 */
router.post(
  '/sessions/:id/resume',
  validate(commonSchemas.idParam, 'params'),
  volumeController.resumeSession
);

/**
 * POST /api/volume/sessions/:id/stop
 * Stop a session
 */
router.post(
  '/sessions/:id/stop',
  validate(commonSchemas.idParam, 'params'),
  volumeController.stopSession
);

// ------------------------------------
// Session Data Routes
// ------------------------------------

/**
 * GET /api/volume/sessions/:id/transactions
 * Get session transactions
 */
router.get(
  '/sessions/:id/transactions',
  validate(commonSchemas.idParam, 'params'),
  volumeController.getTransactions
);

/**
 * GET /api/volume/sessions/:id/stats
 * Get session stats
 */
router.get(
  '/sessions/:id/stats',
  validate(commonSchemas.idParam, 'params'),
  volumeController.getStats
);

export default router;
