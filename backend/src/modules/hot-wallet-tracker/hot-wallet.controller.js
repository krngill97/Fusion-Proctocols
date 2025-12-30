// ===========================================
// Fusion - Hot Wallet Controller
// ===========================================

import { asyncHandler } from '../../shared/middleware/error-handler.middleware.js';
import * as hotWalletService from './hot-wallet.service.js';
import HotWallet from './hot-wallet.model.js';
import { logger } from '../../shared/utils/logger.js';

const log = logger.withContext('HotWalletController');

// ------------------------------------
// Get All Hot Wallets
// ------------------------------------

/**
 * GET /api/hot-wallets
 * Get all hot wallets
 */
export const getAll = asyncHandler(async (req, res) => {
  const { isActive, exchange } = req.query;

  const options = {};
  if (isActive !== undefined) {
    options.isActive = isActive === 'true';
  }
  if (exchange) {
    options.exchange = exchange;
  }

  const hotWallets = await hotWalletService.getAllHotWallets(options);

  res.json({
    success: true,
    data: {
      hotWallets,
      count: hotWallets.length
    }
  });
});

// ------------------------------------
// Get Hot Wallet by ID
// ------------------------------------

/**
 * GET /api/hot-wallets/:id
 * Get a single hot wallet
 */
export const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hotWallet = await hotWalletService.getHotWalletById(id);

  res.json({
    success: true,
    data: hotWallet
  });
});

// ------------------------------------
// Add Hot Wallet
// ------------------------------------

/**
 * POST /api/hot-wallets
 * Add a new hot wallet
 */
export const add = asyncHandler(async (req, res) => {
  const { address, exchange, label } = req.body;

  if (!address || !exchange) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'Address and exchange are required'
      }
    });
  }

  const hotWallet = await hotWalletService.addHotWallet({
    address,
    exchange,
    label
  });

  log.info(`Hot wallet added via API: ${hotWallet.label}`);

  res.status(201).json({
    success: true,
    data: hotWallet
  });
});

// ------------------------------------
// Update Hot Wallet
// ------------------------------------

/**
 * PATCH /api/hot-wallets/:id
 * Update a hot wallet
 */
export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { label, notes, isActive } = req.body;

  const hotWallet = await HotWallet.findById(id);

  if (!hotWallet) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Hot wallet not found'
      }
    });
  }

  if (label !== undefined) hotWallet.label = label;
  if (notes !== undefined) hotWallet.notes = notes;
  if (isActive !== undefined) {
    // Use toggle service to handle subscription
    await hotWalletService.toggleHotWallet(id);
    // Refresh from DB
    const updated = await HotWallet.findById(id);
    return res.json({
      success: true,
      data: updated
    });
  }

  await hotWallet.save();

  res.json({
    success: true,
    data: hotWallet
  });
});

// ------------------------------------
// Remove Hot Wallet
// ------------------------------------

/**
 * DELETE /api/hot-wallets/:id
 * Remove a hot wallet
 */
export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await hotWalletService.removeHotWallet(id);

  res.json({
    success: true,
    message: 'Hot wallet removed'
  });
});

// ------------------------------------
// Toggle Hot Wallet
// ------------------------------------

/**
 * PATCH /api/hot-wallets/:id/toggle
 * Toggle hot wallet active status
 */
export const toggle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hotWallet = await hotWalletService.toggleHotWallet(id);

  res.json({
    success: true,
    data: {
      id: hotWallet._id,
      isActive: hotWallet.isActive
    }
  });
});

// ------------------------------------
// Get Tracker Status
// ------------------------------------

/**
 * GET /api/hot-wallets/tracker/status
 * Get tracker status
 */
export const getTrackerStatus = asyncHandler(async (req, res) => {
  const status = hotWalletService.getTrackerStatus();

  res.json({
    success: true,
    data: status
  });
});

// ------------------------------------
// Start Tracker
// ------------------------------------

/**
 * POST /api/hot-wallets/tracker/start
 * Start the hot wallet tracker
 */
export const startTracker = asyncHandler(async (req, res) => {
  await hotWalletService.startTracking();

  res.json({
    success: true,
    message: 'Hot wallet tracker started'
  });
});

// ------------------------------------
// Stop Tracker
// ------------------------------------

/**
 * POST /api/hot-wallets/tracker/stop
 * Stop the hot wallet tracker
 */
export const stopTracker = asyncHandler(async (req, res) => {
  await hotWalletService.stopTracking();

  res.json({
    success: true,
    message: 'Hot wallet tracker stopped'
  });
});

// ------------------------------------
// Get Recent Transfers
// ------------------------------------

/**
 * GET /api/hot-wallets/transfers
 * Get recent transfers from all hot wallets
 */
export const getTransfers = asyncHandler(async (req, res) => {
  const { hotWalletId, limit } = req.query;

  const options = {};
  if (hotWalletId) options.hotWalletId = hotWalletId;
  if (limit) options.limit = parseInt(limit);

  const transfers = await hotWalletService.getRecentTransfers(options);

  res.json({
    success: true,
    data: {
      transfers,
      count: transfers.length
    }
  });
});

// ------------------------------------
// Get Hot Wallet Stats
// ------------------------------------

/**
 * GET /api/hot-wallets/stats
 * Get aggregated stats across all hot wallets
 */
export const getStats = asyncHandler(async (req, res) => {
  const stats = await HotWallet.getStatsSummary();
  const trackerStatus = hotWalletService.getTrackerStatus();

  res.json({
    success: true,
    data: {
      ...stats,
      trackerRunning: trackerStatus.isTracking,
      activelyTracking: trackerStatus.trackedCount
    }
  });
});

// ------------------------------------
// Get Transfers by Hot Wallet
// ------------------------------------

/**
 * GET /api/hot-wallets/:id/transfers
 * Get transfers for a specific hot wallet
 */
export const getTransfersByWallet = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit } = req.query;

  const transfers = await hotWalletService.getRecentTransfers({
    hotWalletId: id,
    limit: parseInt(limit) || 50
  });

  res.json({
    success: true,
    data: {
      transfers,
      count: transfers.length
    }
  });
});

// ------------------------------------
// Bulk Add Hot Wallets
// ------------------------------------

/**
 * POST /api/hot-wallets/bulk
 * Add multiple hot wallets
 */
export const bulkAdd = asyncHandler(async (req, res) => {
  const { wallets } = req.body;

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
      const hotWallet = await hotWalletService.addHotWallet(wallet);
      results.added.push({
        address: hotWallet.address,
        label: hotWallet.label
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
  getTrackerStatus,
  startTracker,
  stopTracker,
  getTransfers,
  getStats,
  getTransfersByWallet,
  bulkAdd
};
