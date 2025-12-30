// ===========================================
// Fusion - Volume Bot Controller
// ===========================================

import { asyncHandler } from '../../shared/middleware/error-handler.middleware.js';
import * as volumeService from './volume.service.js';
import { logger } from '../../shared/utils/logger.js';

const log = logger.withContext('VolumeController');

// ------------------------------------
// Admin - Delete All Sessions
// ------------------------------------

/**
 * DELETE /api/volume/sessions/admin/clear-all
 * Delete all volume sessions (admin only)
 */
export const clearAllSessions = asyncHandler(async (req, res) => {
  const VolumeSession = (await import('./volume.model.js')).default;

  // Delete all sessions
  const result = await VolumeSession.deleteMany({});

  log.info(`Cleared ${result.deletedCount} volume sessions`);

  res.json({
    success: true,
    data: {
      deletedCount: result.deletedCount,
      message: 'All volume sessions cleared successfully'
    }
  });
});

// ------------------------------------
// Get Bot Status
// ------------------------------------

/**
 * GET /api/volume/status
 * Get volume bot status
 */
export const getStatus = asyncHandler(async (req, res) => {
  const status = await volumeService.getStatus();

  res.json({
    success: true,
    data: status
  });
});

// ------------------------------------
// Create Session
// ------------------------------------

/**
 * POST /api/volume/sessions
 * Create a new volume session
 */
export const createSession = asyncHandler(async (req, res) => {
  const { tokenMint, depositAmount, config } = req.body;
  const userId = req.user.id;

  if (!tokenMint) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Token mint is required'
      }
    });
  }

  if (!depositAmount || depositAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_AMOUNT',
        message: 'Valid deposit amount is required'
      }
    });
  }

  const session = await volumeService.createSession({
    userId,
    tokenMint,
    depositAmount,
    config
  });

  log.info(`Volume session created: ${session._id}`);

  res.status(201).json({
    success: true,
    data: session
  });
});

// ------------------------------------
// Start Session
// ------------------------------------

/**
 * POST /api/volume/sessions/:id/start
 * Start a volume session
 */
export const startSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Verify ownership
  const session = await volumeService.getSession(id);
  if (session.userId.toString() !== userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Not authorized to access this session'
      }
    });
  }

  const updatedSession = await volumeService.startSession(id);

  log.info(`Volume session started: ${id}`);

  res.json({
    success: true,
    data: updatedSession
  });
});

// ------------------------------------
// Pause Session
// ------------------------------------

/**
 * POST /api/volume/sessions/:id/pause
 * Pause a running session
 */
export const pauseSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const session = await volumeService.getSession(id);
  if (session.userId.toString() !== userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Not authorized to access this session'
      }
    });
  }

  const updatedSession = await volumeService.pauseSession(id);

  res.json({
    success: true,
    data: updatedSession
  });
});

// ------------------------------------
// Resume Session
// ------------------------------------

/**
 * POST /api/volume/sessions/:id/resume
 * Resume a paused session
 */
export const resumeSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const session = await volumeService.getSession(id);
  if (session.userId.toString() !== userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Not authorized to access this session'
      }
    });
  }

  const updatedSession = await volumeService.resumeSession(id);

  res.json({
    success: true,
    data: updatedSession
  });
});

// ------------------------------------
// Stop Session
// ------------------------------------

/**
 * POST /api/volume/sessions/:id/stop
 * Stop a session
 */
export const stopSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const session = await volumeService.getSession(id);
  if (session.userId.toString() !== userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Not authorized to access this session'
      }
    });
  }

  const updatedSession = await volumeService.stopSession(id);

  log.info(`Volume session stopped: ${id}`);

  res.json({
    success: true,
    data: updatedSession
  });
});

// ------------------------------------
// Get Session
// ------------------------------------

/**
 * GET /api/volume/sessions/:id
 * Get session details
 */
export const getSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const session = await volumeService.getSession(id);

  if (session.userId.toString() !== userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Not authorized to access this session'
      }
    });
  }

  // Remove secret keys from response
  const sessionData = session.toObject();
  if (sessionData.makerWallets) {
    sessionData.makerWallets = sessionData.makerWallets.map(w => ({
      publicKey: w.publicKey,
      index: w.index,
      balance: w.balance,
      tradesCompleted: w.tradesCompleted
    }));
  }

  res.json({
    success: true,
    data: sessionData
  });
});

// ------------------------------------
// Get User Sessions
// ------------------------------------

/**
 * GET /api/volume/sessions
 * Get user's sessions
 */
export const getUserSessions = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const userId = req.user.id;

  const options = {};
  if (status) options.status = status;
  if (page) options.page = parseInt(page);
  if (limit) options.limit = parseInt(limit);

  const result = await volumeService.getUserSessions(userId, options);

  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Get Session Transactions
// ------------------------------------

/**
 * GET /api/volume/sessions/:id/transactions
 * Get session transactions
 */
export const getTransactions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit } = req.query;
  const userId = req.user.id;

  const session = await volumeService.getSession(id);

  if (session.userId.toString() !== userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Not authorized to access this session'
      }
    });
  }

  // Paginate transactions
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;

  const transactions = session.transactions
    .slice()
    .reverse() // Newest first
    .slice(startIndex, endIndex);

  res.json({
    success: true,
    data: {
      transactions,
      pagination: {
        total: session.transactions.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(session.transactions.length / limitNum)
      }
    }
  });
});

// ------------------------------------
// Get Session Stats
// ------------------------------------

/**
 * GET /api/volume/sessions/:id/stats
 * Get session statistics
 */
export const getStats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const session = await volumeService.getSession(id);

  if (session.userId.toString() !== userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Not authorized to access this session'
      }
    });
  }

  res.json({
    success: true,
    data: {
      stats: session.stats,
      progress: session.progress,
      config: session.config,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt
    }
  });
});

// ------------------------------------
// Get Active Sessions Count
// ------------------------------------

/**
 * GET /api/volume/active-count
 * Get number of active sessions
 */
export const getActiveCount = asyncHandler(async (req, res) => {
  const count = volumeService.getActiveSessionsCount();

  res.json({
    success: true,
    data: { count }
  });
});

export default {
  getStatus,
  createSession,
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  getSession,
  getUserSessions,
  getTransactions,
  getStats,
  getActiveCount
};
