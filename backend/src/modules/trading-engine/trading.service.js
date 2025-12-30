// ===========================================
// Fusion - Trading Service
// ===========================================

import { Keypair, PublicKey } from '@solana/web3.js';
import Trade from './trading.model.js';
import User from '../auth/auth.model.js';
import Settings from '../settings/settings.model.js';
import * as jupiterService from './jupiter.service.js';
import * as raydiumService from './raydium.service.js';
import { getHttpConnection } from '../../config/chainstack.js';
import { wsEvents } from '../../websocket/index.js';
import { decrypt } from '../../shared/services/encryption.service.js';
import { logger } from '../../shared/utils/logger.js';
import { solToLamports, lamportsToSol } from '../../shared/utils/helpers.js';

const log = logger.withContext('TradingService');

// Native SOL mint
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ------------------------------------
// DEX Selection
// ------------------------------------

/**
 * Get best quote from available DEXs
 * @param {Object} params - Quote parameters
 * @returns {Promise<Object>} Best quote
 */
export const getBestQuote = async ({
  inputMint,
  outputMint,
  amount,
  slippageBps = 100,
  preferredDex = 'auto'
}) => {
  const quotes = [];

  // Get Jupiter quote
  if (preferredDex === 'auto' || preferredDex === 'jupiter') {
    try {
      const jupiterQuote = await jupiterService.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps
      });

      if (jupiterQuote.success) {
        quotes.push({
          dex: 'jupiter',
          ...jupiterQuote
        });
      }
    } catch (error) {
      log.debug('Jupiter quote failed:', error.message);
    }
  }

  // Get Raydium quote
  if (preferredDex === 'auto' || preferredDex === 'raydium') {
    try {
      const raydiumQuote = await raydiumService.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps
      });

      if (raydiumQuote.success) {
        quotes.push({
          dex: 'raydium',
          ...raydiumQuote
        });
      }
    } catch (error) {
      log.debug('Raydium quote failed:', error.message);
    }
  }

  if (quotes.length === 0) {
    return {
      success: false,
      error: 'No quotes available from any DEX'
    };
  }

  // Sort by output amount (descending) to get best quote
  quotes.sort((a, b) => {
    const aOut = BigInt(a.outputAmount || 0);
    const bOut = BigInt(b.outputAmount || 0);
    return bOut > aOut ? 1 : bOut < aOut ? -1 : 0;
  });

  const bestQuote = quotes[0];

  return {
    success: true,
    bestQuote,
    allQuotes: quotes,
    dex: bestQuote.dex
  };
};

// ------------------------------------
// Execute Trade
// ------------------------------------

/**
 * Execute a trade
 * @param {Object} params - Trade parameters
 * @returns {Promise<Object>} Trade result
 */
export const executeTrade = async ({
  userId,
  walletId,
  type, // 'buy' or 'sell'
  tokenMint,
  amount, // SOL amount for buy, token amount for sell
  slippageBps,
  priorityFee,
  preferredDex = 'auto'
}) => {
  let trade;

  try {
    // Get user and wallet
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get settings for defaults
    const settings = await Settings.getSettings();

    // Find wallet to use
    let walletData;
    if (walletId) {
      walletData = user.tradingWallets.id(walletId);
    } else {
      walletData = user.tradingWallets.find(w => w.isDefault);
    }

    if (!walletData) {
      throw new Error('No trading wallet found');
    }

    // Decrypt private key
    const secretKey = decrypt(walletData.encryptedPrivateKey, user.walletAddress);
    const wallet = Keypair.fromSecretKey(Buffer.from(secretKey, 'hex'));

    // Apply defaults
    const finalSlippage = slippageBps || settings.trading.defaultSlippageBps;
    const finalPriorityFee = priorityFee || settings.trading.defaultPriorityFee;
    const maxSol = settings.trading.maxSolPerTrade;

    // Validate amount
    if (type === 'buy' && amount > maxSol) {
      throw new Error(`Amount exceeds max SOL per trade (${maxSol})`);
    }

    // Create trade record
    trade = await Trade.create({
      userId,
      type,
      tokenMint,
      inputMint: type === 'buy' ? SOL_MINT : tokenMint,
      outputMint: type === 'buy' ? tokenMint : SOL_MINT,
      inputAmount: type === 'buy' ? solToLamports(amount) : amount,
      walletAddress: wallet.publicKey.toBase58(),
      dex: preferredDex,
      settings: {
        slippageBps: finalSlippage,
        priorityFee: finalPriorityFee
      },
      status: 'pending'
    });

    // Emit pending event
    wsEvents.emitTradeEvent('created', userId, trade.toJSON());

    // Get best quote
    const inputAmount = type === 'buy' 
      ? solToLamports(amount) 
      : amount;

    const quoteResult = await getBestQuote({
      inputMint: trade.inputMint,
      outputMint: trade.outputMint,
      amount: inputAmount,
      slippageBps: finalSlippage,
      preferredDex
    });

    if (!quoteResult.success) {
      throw new Error(quoteResult.error);
    }

    // Update trade with quote info
    trade.dex = quoteResult.dex;
    trade.expectedOutputAmount = quoteResult.bestQuote.outputAmount;
    trade.priceImpact = parseFloat(quoteResult.bestQuote.priceImpactPct || 0);
    trade.status = 'executing';
    await trade.save();

    // Emit executing event
    wsEvents.emitTradeEvent('updated', userId, trade.toJSON());

    // Execute on chosen DEX
    let result;
    if (quoteResult.dex === 'jupiter') {
      result = await jupiterService.executeSwap({
        inputMint: trade.inputMint,
        outputMint: trade.outputMint,
        amount: inputAmount,
        slippageBps: finalSlippage,
        wallet,
        priorityFee: finalPriorityFee
      });
    } else {
      result = await raydiumService.executeSwap({
        inputMint: trade.inputMint,
        outputMint: trade.outputMint,
        amount: inputAmount,
        slippageBps: finalSlippage,
        wallet,
        priorityFee: finalPriorityFee
      });
    }

    if (!result.success) {
      throw new Error(result.error);
    }

    // Update trade as completed
    trade.status = 'completed';
    trade.txSignature = result.signature;
    trade.actualOutputAmount = result.outputAmount;
    trade.completedAt = new Date();
    await trade.save();

    log.info(`Trade completed: ${type} ${tokenMint.slice(0, 8)}... - ${result.signature}`);

    // Emit completed event
    wsEvents.emitTradeEvent('completed', userId, trade.toJSON());

    return {
      success: true,
      trade: trade.toJSON(),
      signature: result.signature
    };

  } catch (error) {
    log.error('Trade execution error:', error.message);

    // Update trade as failed
    if (trade) {
      trade.status = 'failed';
      trade.error = {
        message: error.message,
        code: 'EXECUTION_ERROR'
      };
      await trade.save();

      // Emit failed event
      wsEvents.emitTradeEvent('failed', userId, trade.toJSON(), error.message);
    }

    return {
      success: false,
      error: error.message,
      trade: trade?.toJSON()
    };
  }
};

// ------------------------------------
// Buy Token
// ------------------------------------

/**
 * Buy a token with SOL
 * @param {Object} params - Buy parameters
 * @returns {Promise<Object>} Trade result
 */
export const buyToken = async ({
  userId,
  walletId,
  tokenMint,
  solAmount,
  slippageBps,
  priorityFee,
  preferredDex
}) => {
  return executeTrade({
    userId,
    walletId,
    type: 'buy',
    tokenMint,
    amount: solAmount,
    slippageBps,
    priorityFee,
    preferredDex
  });
};

// ------------------------------------
// Sell Token
// ------------------------------------

/**
 * Sell a token for SOL
 * @param {Object} params - Sell parameters
 * @returns {Promise<Object>} Trade result
 */
export const sellToken = async ({
  userId,
  walletId,
  tokenMint,
  tokenAmount,
  slippageBps,
  priorityFee,
  preferredDex
}) => {
  return executeTrade({
    userId,
    walletId,
    type: 'sell',
    tokenMint,
    amount: tokenAmount,
    slippageBps,
    priorityFee,
    preferredDex
  });
};

// ------------------------------------
// Get Quote (Simulation)
// ------------------------------------

/**
 * Get quote without executing
 * @param {Object} params - Quote parameters
 * @returns {Promise<Object>} Quote result
 */
export const getQuote = async ({
  type,
  tokenMint,
  amount,
  slippageBps = 100,
  preferredDex = 'auto'
}) => {
  const inputMint = type === 'buy' ? SOL_MINT : tokenMint;
  const outputMint = type === 'buy' ? tokenMint : SOL_MINT;
  const inputAmount = type === 'buy' ? solToLamports(amount) : amount;

  const quoteResult = await getBestQuote({
    inputMint,
    outputMint,
    amount: inputAmount,
    slippageBps,
    preferredDex
  });

  if (!quoteResult.success) {
    return quoteResult;
  }

  const best = quoteResult.bestQuote;

  return {
    success: true,
    quote: {
      type,
      tokenMint,
      inputMint,
      outputMint,
      inputAmount: type === 'buy' ? amount : amount,
      outputAmount: outputMint === SOL_MINT 
        ? lamportsToSol(best.outputAmount)
        : best.outputAmount,
      priceImpact: parseFloat(best.priceImpactPct || 0),
      dex: quoteResult.dex
    },
    allQuotes: quoteResult.allQuotes.map(q => ({
      dex: q.dex,
      outputAmount: q.outputAmount,
      priceImpact: q.priceImpactPct
    }))
  };
};

// ------------------------------------
// Get Token Price
// ------------------------------------

/**
 * Get token price from multiple sources
 * @param {string} tokenMint - Token mint address
 * @returns {Promise<Object>} Price data
 */
export const getTokenPrice = async (tokenMint) => {
  const prices = {};

  // Try Jupiter
  try {
    const jupiterPrice = await jupiterService.getTokenPrice(tokenMint);
    if (jupiterPrice.success && jupiterPrice.prices[tokenMint]) {
      prices.jupiter = jupiterPrice.prices[tokenMint].price;
    }
  } catch (error) {
    log.debug('Jupiter price failed:', error.message);
  }

  // Try Raydium
  try {
    const raydiumPrice = await raydiumService.getTokenPrice(tokenMint);
    if (raydiumPrice.success) {
      prices.raydium = raydiumPrice.price;
    }
  } catch (error) {
    log.debug('Raydium price failed:', error.message);
  }

  if (Object.keys(prices).length === 0) {
    return {
      success: false,
      error: 'Unable to fetch price from any source'
    };
  }

  // Average price
  const avgPrice = Object.values(prices).reduce((a, b) => a + b, 0) / Object.values(prices).length;

  return {
    success: true,
    price: avgPrice,
    sources: prices
  };
};

// ------------------------------------
// Get Trade History
// ------------------------------------

/**
 * Get trade history for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Trade history
 */
export const getTradeHistory = async (userId, options = {}) => {
  const query = { userId };

  if (options.type) {
    query.type = options.type;
  }

  if (options.status) {
    query.status = options.status;
  }

  if (options.tokenMint) {
    query.tokenMint = options.tokenMint;
  }

  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  const [trades, total] = await Promise.all([
    Trade.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Trade.countDocuments(query)
  ]);

  return {
    trades,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

// ------------------------------------
// Get Trade by ID
// ------------------------------------

/**
 * Get a specific trade
 * @param {string} userId - User ID
 * @param {string} tradeId - Trade ID
 * @returns {Promise<Object>} Trade
 */
export const getTradeById = async (userId, tradeId) => {
  const trade = await Trade.findOne({ _id: tradeId, userId });

  if (!trade) {
    throw new Error('Trade not found');
  }

  return trade;
};

// ------------------------------------
// Get Trade Stats
// ------------------------------------

/**
 * Get trading statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Stats
 */
export const getTradeStats = async (userId) => {
  const stats = await Trade.aggregate([
    { $match: { userId: new (await import('mongoose')).default.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        completedTrades: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failedTrades: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        totalBuys: {
          $sum: { $cond: [{ $eq: ['$type', 'buy'] }, 1, 0] }
        },
        totalSells: {
          $sum: { $cond: [{ $eq: ['$type', 'sell'] }, 1, 0] }
        }
      }
    }
  ]);

  return stats[0] || {
    totalTrades: 0,
    completedTrades: 0,
    failedTrades: 0,
    totalBuys: 0,
    totalSells: 0
  };
};

// ------------------------------------
// Cancel Pending Trade
// ------------------------------------

/**
 * Cancel a pending trade
 * @param {string} userId - User ID
 * @param {string} tradeId - Trade ID
 * @returns {Promise<Object>} Cancelled trade
 */
export const cancelTrade = async (userId, tradeId) => {
  const trade = await Trade.findOne({ _id: tradeId, userId });

  if (!trade) {
    throw new Error('Trade not found');
  }

  if (trade.status !== 'pending') {
    throw new Error('Can only cancel pending trades');
  }

  trade.status = 'cancelled';
  await trade.save();

  return trade;
};

export default {
  getBestQuote,
  executeTrade,
  buyToken,
  sellToken,
  getQuote,
  getTokenPrice,
  getTradeHistory,
  getTradeById,
  getTradeStats,
  cancelTrade
};
