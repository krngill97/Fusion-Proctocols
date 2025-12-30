// ===========================================
// Fusion - Subwallet Controller
// ===========================================

import { asyncHandler } from '../../shared/middleware/error-handler.middleware.js';
import * as subwalletService from './subwallet.service.js';
import { logger } from '../../shared/utils/logger.js';

const log = logger.withContext('SubwalletController');

// ------------------------------------
// Get All Subwallets
// ------------------------------------

/**
 * GET /api/subwallets
 * Get all subwallets with filtering
 */
export const getAll = asyncHandler(async (req, res) => {
  const { 
    status, 
    hotWalletId, 
    hasMinted, 
    hasCreatedPool, 
    hasBoughtToken,
    page,
    limit 
  } = req.query;

  const options = {};
  
  if (status) options.status = status;
  if (hotWalletId) options.hotWalletId = hotWalletId;
  if (hasMinted !== undefined) options.hasMinted = hasMinted === 'true';
  if (hasCreatedPool !== undefined) options.hasCreatedPool = hasCreatedPool === 'true';
  if (hasBoughtToken !== undefined) options.hasBoughtToken = hasBoughtToken === 'true';
  if (page) options.page = parseInt(page);
  if (limit) options.limit = parseInt(limit);

  const result = await subwalletService.getSubwallets(options);

  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Get Subwallet by ID
// ------------------------------------

/**
 * GET /api/subwallets/:id
 * Get a single subwallet
 */
export const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subwallet = await subwalletService.getSubwalletById(id);

  res.json({
    success: true,
    data: subwallet
  });
});

// ------------------------------------
// Get Subwallet by Address
// ------------------------------------

/**
 * GET /api/subwallets/address/:address
 * Get subwallet by wallet address
 */
export const getByAddress = asyncHandler(async (req, res) => {
  const { address } = req.params;

  const subwallet = await subwalletService.getSubwalletByAddress(address);

  if (!subwallet) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Subwallet not found'
      }
    });
  }

  res.json({
    success: true,
    data: subwallet
  });
});

// ------------------------------------
// Get Recent Mints
// ------------------------------------

/**
 * GET /api/subwallets/mints/recent
 * Get recent token mints from subwallets
 */
export const getRecentMints = asyncHandler(async (req, res) => {
  const { limit } = req.query;

  const mints = await subwalletService.getRecentMints(parseInt(limit) || 20);

  res.json({
    success: true,
    data: {
      mints,
      count: mints.length
    }
  });
});

// ------------------------------------
// Get Active Subwallets (with activity)
// ------------------------------------

/**
 * GET /api/subwallets/active
 * Get subwallets that have detected activity
 */
export const getActive = asyncHandler(async (req, res) => {
  const { limit } = req.query;

  const result = await subwalletService.getSubwallets({
    status: 'active',
    limit: parseInt(limit) || 50
  });

  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Get Watching Subwallets
// ------------------------------------

/**
 * GET /api/subwallets/watching
 * Get subwallets currently being watched
 */
export const getWatching = asyncHandler(async (req, res) => {
  const { limit } = req.query;

  const result = await subwalletService.getSubwallets({
    status: 'watching',
    limit: parseInt(limit) || 50
  });

  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Get Stats
// ------------------------------------

/**
 * GET /api/subwallets/stats
 * Get subwallet statistics
 */
export const getStats = asyncHandler(async (req, res) => {
  const stats = await subwalletService.getStats();

  res.json({
    success: true,
    data: stats
  });
});

// ------------------------------------
// Get Analyzer Status
// ------------------------------------

/**
 * GET /api/subwallets/analyzer/status
 * Get analyzer status
 */
export const getAnalyzerStatus = asyncHandler(async (req, res) => {
  const status = subwalletService.getAnalyzerStatus();

  res.json({
    success: true,
    data: status
  });
});

// ------------------------------------
// Start Analyzer
// ------------------------------------

/**
 * POST /api/subwallets/analyzer/start
 * Start the subwallet analyzer
 */
export const startAnalyzer = asyncHandler(async (req, res) => {
  await subwalletService.startAnalyzing();

  res.json({
    success: true,
    message: 'Subwallet analyzer started'
  });
});

// ------------------------------------
// Stop Analyzer
// ------------------------------------

/**
 * POST /api/subwallets/analyzer/stop
 * Stop the subwallet analyzer
 */
export const stopAnalyzer = asyncHandler(async (req, res) => {
  await subwalletService.stopAnalyzing();

  res.json({
    success: true,
    message: 'Subwallet analyzer stopped'
  });
});

// ------------------------------------
// Extend Watch Time
// ------------------------------------

/**
 * PATCH /api/subwallets/:id/extend
 * Extend watch time for a subwallet
 */
export const extendWatchTime = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { hours } = req.body;

  const subwallet = await subwalletService.extendWatchTime(id, hours || 24);

  res.json({
    success: true,
    data: {
      id: subwallet._id,
      watchUntil: subwallet.watchUntil,
      message: `Watch time extended by ${hours || 24} hours`
    }
  });
});

// ------------------------------------
// Manually Add Subwallet
// ------------------------------------

/**
 * POST /api/subwallets
 * Manually add a wallet to analyze
 */
export const addSubwallet = asyncHandler(async (req, res) => {
  const { address, hotWalletId, amount } = req.body;

  if (!address) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_ADDRESS',
        message: 'Wallet address is required'
      }
    });
  }

  const subwallet = await subwalletService.addSubwallet(
    address,
    hotWalletId,
    amount || 0
  );

  log.info(`Subwallet manually added: ${address.slice(0, 8)}...`);

  res.status(201).json({
    success: true,
    data: subwallet
  });
});

// ------------------------------------
// Get Subwallet Mints
// ------------------------------------

/**
 * GET /api/subwallets/:id/mints
 * Get mints for a specific subwallet
 */
export const getMints = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subwallet = await subwalletService.getSubwalletById(id);

  res.json({
    success: true,
    data: {
      mints: subwallet.activity.mintedTokens,
      count: subwallet.activity.mintedTokens.length
    }
  });
});

// ------------------------------------
// Get Subwallet Pools
// ------------------------------------

/**
 * GET /api/subwallets/:id/pools
 * Get pool creations for a specific subwallet
 */
export const getPools = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subwallet = await subwalletService.getSubwalletById(id);

  res.json({
    success: true,
    data: {
      pools: subwallet.activity.createdPools,
      count: subwallet.activity.createdPools.length
    }
  });
});

// ------------------------------------
// Get Subwallet Buys
// ------------------------------------

/**
 * GET /api/subwallets/:id/buys
 * Get token purchases for a specific subwallet
 */
export const getBuys = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subwallet = await subwalletService.getSubwalletById(id);

  res.json({
    success: true,
    data: {
      buys: subwallet.activity.tokenPurchases,
      count: subwallet.activity.tokenPurchases.length
    }
  });
});

// ------------------------------------
// Get Subwallets by Hot Wallet
// ------------------------------------

/**
 * GET /api/subwallets/by-hot-wallet/:hotWalletId
 * Get subwallets from a specific hot wallet
 */
export const getByHotWallet = asyncHandler(async (req, res) => {
  const { hotWalletId } = req.params;
  const { status, limit } = req.query;

  const options = { hotWalletId };
  if (status) options.status = status;
  if (limit) options.limit = parseInt(limit);

  const result = await subwalletService.getSubwallets(options);

  res.json({
    success: true,
    data: result
  });
});

export default {
  getAll,
  getById,
  getByAddress,
  getRecentMints,
  getActive,
  getWatching,
  getStats,
  getAnalyzerStatus,
  startAnalyzer,
  stopAnalyzer,
  extendWatchTime,
  addSubwallet,
  getMints,
  getPools,
  getBuys,
  getByHotWallet
};
