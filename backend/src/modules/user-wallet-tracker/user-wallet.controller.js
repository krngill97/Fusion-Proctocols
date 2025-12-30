// ===========================================
// Fusion - User Wallet Controller
// ===========================================

import { asyncHandler } from '../../shared/middleware/error-handler.middleware.js';
import * as userWalletService from './user-wallet.service.js';
import { logger } from '../../shared/utils/logger.js';

const log = logger.withContext('UserWalletController');

// ------------------------------------
// Get User Wallets
// ------------------------------------

/**
 * GET /api/user-wallets
 * Get all wallets for authenticated user
 */
export const getAll = asyncHandler(async (req, res) => {
  const { isActive } = req.query;
  const userId = req.user.id;

  const options = {};
  if (isActive !== undefined) {
    options.isActive = isActive === 'true';
  }

  const wallets = await userWalletService.getUserWallets(userId, options);

  res.json({
    success: true,
    data: {
      wallets,
      count: wallets.length
    }
  });
});

// ------------------------------------
// Get User Wallet by ID
// ------------------------------------

/**
 * GET /api/user-wallets/:id
 * Get a single wallet
 */
export const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const wallet = await userWalletService.getUserWalletById(userId, id);

  res.json({
    success: true,
    data: wallet
  });
});

// ------------------------------------
// Add User Wallet
// ------------------------------------

/**
 * POST /api/user-wallets
 * Add a new wallet to track
 */
export const add = asyncHandler(async (req, res) => {
  const { address, label, notes } = req.body;
  const userId = req.user.id;

  if (!address) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_ADDRESS',
        message: 'Wallet address is required'
      }
    });
  }

  const wallet = await userWalletService.addUserWallet(userId, address, {
    label,
    notes,
    source: 'manual'
  });

  log.info(`User wallet added via API: ${address.slice(0, 8)}...`);

  res.status(201).json({
    success: true,
    data: wallet
  });
});

// ------------------------------------
// Update User Wallet
// ------------------------------------

/**
 * PATCH /api/user-wallets/:id
 * Update wallet details
 */
export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { label, notes } = req.body;
  const userId = req.user.id;

  const wallet = await userWalletService.updateUserWallet(userId, id, {
    label,
    notes
  });

  res.json({
    success: true,
    data: wallet
  });
});

// ------------------------------------
// Remove User Wallet
// ------------------------------------

/**
 * DELETE /api/user-wallets/:id
 * Remove a wallet from tracking
 */
export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await userWalletService.removeUserWallet(userId, id);

  res.json({
    success: true,
    message: 'Wallet removed from tracking'
  });
});

// ------------------------------------
// Toggle User Wallet
// ------------------------------------

/**
 * PATCH /api/user-wallets/:id/toggle
 * Toggle wallet active status
 */
export const toggle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const wallet = await userWalletService.toggleUserWallet(userId, id);

  res.json({
    success: true,
    data: {
      id: wallet._id,
      isActive: wallet.isActive
    }
  });
});

// ------------------------------------
// Get Wallet Signals
// ------------------------------------

/**
 * GET /api/user-wallets/:id/signals
 * Get signals for a wallet
 */
export const getSignals = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, limit } = req.query;
  const userId = req.user.id;

  const options = {};
  if (type) options.type = type;
  if (limit) options.limit = parseInt(limit);

  const signals = await userWalletService.getSignals(userId, id, options);

  res.json({
    success: true,
    data: {
      signals,
      count: signals.length
    }
  });
});

// ------------------------------------
// Get All User Signals
// ------------------------------------

/**
 * GET /api/user-wallets/signals/all
 * Get all recent signals across all wallets
 */
export const getAllSignals = asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const userId = req.user.id;

  const signals = await userWalletService.getAllUserSignals(
    userId,
    parseInt(limit) || 50
  );

  res.json({
    success: true,
    data: {
      signals,
      count: signals.length
    }
  });
});

// ------------------------------------
// Import from Subwallet
// ------------------------------------

/**
 * POST /api/user-wallets/import/subwallet
 * Import a subwallet to track
 */
export const importFromSubwallet = asyncHandler(async (req, res) => {
  const { subwalletId } = req.body;
  const userId = req.user.id;

  if (!subwalletId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_SUBWALLET_ID',
        message: 'Subwallet ID is required'
      }
    });
  }

  const wallet = await userWalletService.importFromSubwallet(userId, subwalletId);

  res.status(201).json({
    success: true,
    data: wallet
  });
});

// ------------------------------------
// Get User Stats
// ------------------------------------

/**
 * GET /api/user-wallets/stats
 * Get wallet tracking stats
 */
export const getStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const stats = await userWalletService.getUserStats(userId);

  res.json({
    success: true,
    data: stats
  });
});

// ------------------------------------
// Get Tracker Status
// ------------------------------------

/**
 * GET /api/user-wallets/tracker/status
 * Get tracker status
 */
export const getTrackerStatus = asyncHandler(async (req, res) => {
  const status = userWalletService.getTrackerStatus();

  res.json({
    success: true,
    data: status
  });
});

// ------------------------------------
// Start Tracker
// ------------------------------------

/**
 * POST /api/user-wallets/tracker/start
 * Start the tracker
 */
export const startTracker = asyncHandler(async (req, res) => {
  await userWalletService.startTracking();

  res.json({
    success: true,
    message: 'User wallet tracker started'
  });
});

// ------------------------------------
// Stop Tracker
// ------------------------------------

/**
 * POST /api/user-wallets/tracker/stop
 * Stop the tracker
 */
export const stopTracker = asyncHandler(async (req, res) => {
  await userWalletService.stopTracking();

  res.json({
    success: true,
    message: 'User wallet tracker stopped'
  });
});

// ------------------------------------
// Bulk Add Wallets
// ------------------------------------

/**
 * POST /api/user-wallets/bulk
 * Add multiple wallets
 */
export const bulkAdd = asyncHandler(async (req, res) => {
  const { wallets } = req.body;
  const userId = req.user.id;

  if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Wallets array is required'
      }
    });
  }

  const results = {
    added: [],
    failed: []
  };

  for (const wallet of wallets) {
    try {
      const userWallet = await userWalletService.addUserWallet(userId, wallet.address, {
        label: wallet.label,
        notes: wallet.notes,
        source: 'bulk'
      });
      results.added.push({
        address: userWallet.address,
        label: userWallet.label
      });
    } catch (error) {
      results.failed.push({
        address: wallet.address,
        error: error.message
      });
    }
  }

  log.info(`Bulk add: ${results.added.length} added, ${results.failed.length} failed`);

  res.status(201).json({
    success: true,
    data: results
  });
});

export default {
  getAll,
  getById,
  add,
  update,
  remove,
  toggle,
  getSignals,
  getAllSignals,
  importFromSubwallet,
  getStats,
  getTrackerStatus,
  startTracker,
  stopTracker,
  bulkAdd
};
