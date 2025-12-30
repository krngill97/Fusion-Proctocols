// ===========================================
// Fusion - Trading Controller
// ===========================================

import { asyncHandler } from '../../shared/middleware/error-handler.middleware.js';
import * as tradingService from './trading.service.js';
import * as jupiterService from './jupiter.service.js';
import * as raydiumService from './raydium.service.js';
import { logger } from '../../shared/utils/logger.js';

const log = logger.withContext('TradingController');

// ------------------------------------
// Get Quote
// ------------------------------------

/**
 * POST /api/trading/quote
 * Get a swap quote
 */
export const getQuote = asyncHandler(async (req, res) => {
  const { type, tokenMint, amount, slippageBps, preferredDex } = req.body;

  if (!type || !tokenMint || !amount) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'type, tokenMint, and amount are required'
      }
    });
  }

  const result = await tradingService.getQuote({
    type,
    tokenMint,
    amount,
    slippageBps,
    preferredDex
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'QUOTE_FAILED',
        message: result.error
      }
    });
  }

  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Buy Token
// ------------------------------------

/**
 * POST /api/trading/buy
 * Execute a buy trade
 */
export const buyToken = asyncHandler(async (req, res) => {
  const { tokenMint, solAmount, walletId, slippageBps, priorityFee, preferredDex } = req.body;
  const userId = req.user.id;

  if (!tokenMint || !solAmount) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'tokenMint and solAmount are required'
      }
    });
  }

  if (solAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_AMOUNT',
        message: 'Amount must be greater than 0'
      }
    });
  }

  const result = await tradingService.buyToken({
    userId,
    walletId,
    tokenMint,
    solAmount,
    slippageBps,
    priorityFee,
    preferredDex
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'TRADE_FAILED',
        message: result.error
      },
      trade: result.trade
    });
  }

  log.info(`Buy executed: ${tokenMint.slice(0, 8)}... for ${solAmount} SOL`);

  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Sell Token
// ------------------------------------

/**
 * POST /api/trading/sell
 * Execute a sell trade
 */
export const sellToken = asyncHandler(async (req, res) => {
  const { tokenMint, tokenAmount, walletId, slippageBps, priorityFee, preferredDex } = req.body;
  const userId = req.user.id;

  if (!tokenMint || !tokenAmount) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'tokenMint and tokenAmount are required'
      }
    });
  }

  const result = await tradingService.sellToken({
    userId,
    walletId,
    tokenMint,
    tokenAmount,
    slippageBps,
    priorityFee,
    preferredDex
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'TRADE_FAILED',
        message: result.error
      },
      trade: result.trade
    });
  }

  log.info(`Sell executed: ${tokenMint.slice(0, 8)}...`);

  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Get Trade History
// ------------------------------------

/**
 * GET /api/trading/history
 * Get trade history
 */
export const getHistory = asyncHandler(async (req, res) => {
  const { type, status, tokenMint, page, limit } = req.query;
  const userId = req.user.id;

  const options = {};
  if (type) options.type = type;
  if (status) options.status = status;
  if (tokenMint) options.tokenMint = tokenMint;
  if (page) options.page = parseInt(page);
  if (limit) options.limit = parseInt(limit);

  const result = await tradingService.getTradeHistory(userId, options);

  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Get Trade by ID
// ------------------------------------

/**
 * GET /api/trading/trades/:id
 * Get a specific trade
 */
export const getTradeById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const trade = await tradingService.getTradeById(userId, id);

  res.json({
    success: true,
    data: trade
  });
});

// ------------------------------------
// Cancel Trade
// ------------------------------------

/**
 * POST /api/trading/trades/:id/cancel
 * Cancel a pending trade
 */
export const cancelTrade = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const trade = await tradingService.cancelTrade(userId, id);

  res.json({
    success: true,
    data: trade
  });
});

// ------------------------------------
// Get Trade Stats
// ------------------------------------

/**
 * GET /api/trading/stats
 * Get trading statistics
 */
export const getStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const stats = await tradingService.getTradeStats(userId);

  res.json({
    success: true,
    data: stats
  });
});

// ------------------------------------
// Get Token Price
// ------------------------------------

/**
 * GET /api/trading/price/:tokenMint
 * Get token price
 */
export const getTokenPrice = asyncHandler(async (req, res) => {
  const { tokenMint } = req.params;

  const result = await tradingService.getTokenPrice(tokenMint);

  if (!result.success) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'PRICE_NOT_FOUND',
        message: result.error
      }
    });
  }

  res.json({
    success: true,
    data: result
  });
});

// ------------------------------------
// Get Token Info
// ------------------------------------

/**
 * GET /api/trading/token/:tokenMint
 * Get token info from Jupiter
 */
export const getTokenInfo = asyncHandler(async (req, res) => {
  const { tokenMint } = req.params;

  const result = await jupiterService.getTokenInfo(tokenMint);

  if (!result.success) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'TOKEN_NOT_FOUND',
        message: result.error
      }
    });
  }

  res.json({
    success: true,
    data: result.token
  });
});

// ------------------------------------
// Search Pools
// ------------------------------------

/**
 * GET /api/trading/pools/:tokenMint
 * Search Raydium pools for a token
 */
export const searchPools = asyncHandler(async (req, res) => {
  const { tokenMint } = req.params;

  const result = await raydiumService.searchPoolsByToken(tokenMint);

  if (!result.success) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'POOLS_NOT_FOUND',
        message: result.error
      }
    });
  }

  res.json({
    success: true,
    data: {
      pools: result.pools,
      count: result.count
    }
  });
});

// ------------------------------------
// Simulate Trade
// ------------------------------------

/**
 * POST /api/trading/simulate
 * Simulate a trade without executing
 */
export const simulateTrade = asyncHandler(async (req, res) => {
  const { type, tokenMint, amount, slippageBps, preferredDex } = req.body;

  if (!type || !tokenMint || !amount) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'type, tokenMint, and amount are required'
      }
    });
  }

  const result = await tradingService.getQuote({
    type,
    tokenMint,
    amount,
    slippageBps,
    preferredDex
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'SIMULATION_FAILED',
        message: result.error
      }
    });
  }

  res.json({
    success: true,
    data: {
      simulation: result.quote,
      allQuotes: result.allQuotes,
      recommendation: result.quote.dex
    }
  });
});

export default {
  getQuote,
  buyToken,
  sellToken,
  getHistory,
  getTradeById,
  cancelTrade,
  getStats,
  getTokenPrice,
  getTokenInfo,
  searchPools,
  simulateTrade
};
