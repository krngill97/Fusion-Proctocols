/**
 * Testnet Liquidity Pool Service
 * Simulate Raydium-style AMM pools for testing
 */

import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const POOLS_STORAGE_KEY = 'testnet_pools';
const POOL_TRADES_KEY = 'testnet_pool_trades';
const USER_POSITIONS_KEY = 'testnet_user_positions';

const AMM_FEE = 0.0025; // 0.25% trading fee

/**
 * Generate unique pool ID
 */
const generatePoolId = () => {
  return `pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new liquidity pool
 */
export const createLiquidityPool = (tokenMint, tokenData, solAmount, tokenAmount, walletAddress) => {
  try {
    // Calculate initial price
    const initialPrice = solAmount / tokenAmount;

    // Calculate LP tokens (geometric mean)
    const lpSupply = Math.sqrt(solAmount * tokenAmount);

    const pool = {
      id: generatePoolId(),
      tokenMint,
      tokenName: tokenData.name,
      tokenSymbol: tokenData.symbol,
      tokenImage: tokenData.image,
      tokenDecimals: tokenData.decimals,

      // Reserves
      baseMint: 'SOL',
      baseReserve: solAmount, // SOL
      quoteReserve: tokenAmount, // Token

      // LP tokens
      lpSupply,
      lpDecimals: 9,

      // Fees
      fee: AMM_FEE,
      feesCollected: {
        sol: 0,
        token: 0
      },

      // Pool state
      currentPrice: initialPrice,
      initialPrice,
      priceHistory: [{
        timestamp: Date.now(),
        price: initialPrice
      }],

      // Stats
      volume24h: 0,
      volumeTotal: 0,
      transactions: 0,
      liquidity: solAmount, // in SOL

      // Creator
      creator: walletAddress,
      createdAt: Date.now(),

      // Status
      isActive: true,
      network: 'devnet'
    };

    // Save pool
    savePool(pool);

    // Create initial LP position for creator
    createLPPosition(pool.id, walletAddress, lpSupply, solAmount, tokenAmount);

    console.log('Liquidity pool created:', pool);
    return pool;

  } catch (error) {
    console.error('Failed to create pool:', error);
    throw error;
  }
};

/**
 * Save pool to localStorage
 */
const savePool = (pool) => {
  try {
    const pools = getPools();

    // Update existing or add new
    const index = pools.findIndex(p => p.id === pool.id);
    if (index !== -1) {
      pools[index] = pool;
    } else {
      pools.unshift(pool);
    }

    localStorage.setItem(POOLS_STORAGE_KEY, JSON.stringify(pools));
  } catch (error) {
    console.error('Failed to save pool:', error);
  }
};

/**
 * Get all pools
 */
export const getPools = () => {
  try {
    const data = localStorage.getItem(POOLS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load pools:', error);
    return [];
  }
};

/**
 * Get pool by ID
 */
export const getPool = (poolId) => {
  try {
    const pools = getPools();
    return pools.find(p => p.id === poolId) || null;
  } catch (error) {
    console.error('Failed to get pool:', error);
    return null;
  }
};

/**
 * Get pool by token mint
 */
export const getPoolByToken = (tokenMint) => {
  try {
    const pools = getPools();
    return pools.find(p => p.tokenMint === tokenMint) || null;
  } catch (error) {
    console.error('Failed to get pool by token:', error);
    return null;
  }
};

/**
 * Simulate a trade (buy or sell)
 * Using constant product formula: x * y = k
 */
export const simulateTrade = (pool, action, amountIn, slippageTolerance = 1.0) => {
  try {
    const { baseReserve, quoteReserve, fee } = pool;

    // Apply fee
    const amountWithFee = amountIn * (1 - fee);

    let amountOut, newBaseReserve, newQuoteReserve, priceImpact;

    if (action === 'buy') {
      // Buying tokens with SOL
      newBaseReserve = baseReserve + amountWithFee;
      newQuoteReserve = (baseReserve * quoteReserve) / newBaseReserve;
      amountOut = quoteReserve - newQuoteReserve;

      // Calculate price impact
      const expectedPrice = baseReserve / quoteReserve;
      const actualPrice = amountIn / amountOut;
      priceImpact = ((actualPrice - expectedPrice) / expectedPrice) * 100;

    } else if (action === 'sell') {
      // Selling tokens for SOL
      newQuoteReserve = quoteReserve + amountWithFee;
      newBaseReserve = (baseReserve * quoteReserve) / newQuoteReserve;
      amountOut = baseReserve - newBaseReserve;

      // Calculate price impact
      const expectedPrice = baseReserve / quoteReserve;
      const actualPrice = amountOut / amountIn;
      priceImpact = ((expectedPrice - actualPrice) / expectedPrice) * 100;

    } else {
      throw new Error('Invalid action. Use "buy" or "sell"');
    }

    // Check slippage
    if (Math.abs(priceImpact) > slippageTolerance) {
      throw new Error(`Slippage tolerance exceeded: ${priceImpact.toFixed(2)}%`);
    }

    const newPrice = newBaseReserve / newQuoteReserve;

    return {
      amountIn,
      amountOut,
      priceImpact,
      newPrice,
      newBaseReserve,
      newQuoteReserve,
      fee: amountIn * fee
    };

  } catch (error) {
    console.error('Trade simulation failed:', error);
    throw error;
  }
};

/**
 * Execute trade and update pool
 */
export const executeTrade = (poolId, walletAddress, action, amountIn, slippageTolerance = 1.0) => {
  try {
    const pool = getPool(poolId);
    if (!pool) throw new Error('Pool not found');

    // Simulate trade
    const trade = simulateTrade(pool, action, amountIn, slippageTolerance);

    // Update pool reserves
    pool.baseReserve = trade.newBaseReserve;
    pool.quoteReserve = trade.newQuoteReserve;
    pool.currentPrice = trade.newPrice;

    // Update stats
    pool.volume24h += amountIn;
    pool.volumeTotal += amountIn;
    pool.transactions += 1;
    pool.liquidity = pool.baseReserve;

    // Track fees
    if (action === 'buy') {
      pool.feesCollected.sol += trade.fee;
    } else {
      pool.feesCollected.token += trade.fee;
    }

    // Update price history
    pool.priceHistory.push({
      timestamp: Date.now(),
      price: trade.newPrice
    });

    // Keep only last 1000 price points
    if (pool.priceHistory.length > 1000) {
      pool.priceHistory = pool.priceHistory.slice(-1000);
    }

    // Save updated pool
    savePool(pool);

    // Record trade
    const tradeRecord = {
      poolId,
      wallet: walletAddress,
      action,
      amountIn: trade.amountIn,
      amountOut: trade.amountOut,
      price: trade.newPrice,
      priceImpact: trade.priceImpact,
      fee: trade.fee,
      timestamp: Date.now()
    };
    saveTrade(tradeRecord);

    console.log('Trade executed:', tradeRecord);

    return {
      success: true,
      trade: tradeRecord,
      pool
    };

  } catch (error) {
    console.error('Trade execution failed:', error);
    throw error;
  }
};

/**
 * Add liquidity to pool
 */
export const addLiquidity = (poolId, walletAddress, solAmount, tokenAmount) => {
  try {
    const pool = getPool(poolId);
    if (!pool) throw new Error('Pool not found');

    // Calculate optimal amounts based on current ratio
    const currentRatio = pool.baseReserve / pool.quoteReserve;
    const providedRatio = solAmount / tokenAmount;

    // Adjust amounts to match pool ratio
    let finalSolAmount = solAmount;
    let finalTokenAmount = tokenAmount;

    if (Math.abs(providedRatio - currentRatio) > 0.001) {
      // Use the smaller ratio to prevent excess
      if (providedRatio > currentRatio) {
        finalSolAmount = tokenAmount * currentRatio;
      } else {
        finalTokenAmount = solAmount / currentRatio;
      }
    }

    // Calculate LP tokens to mint
    const liquidityMinted = (finalSolAmount / pool.baseReserve) * pool.lpSupply;

    // Update pool reserves
    pool.baseReserve += finalSolAmount;
    pool.quoteReserve += finalTokenAmount;
    pool.lpSupply += liquidityMinted;
    pool.liquidity = pool.baseReserve;

    // Save pool
    savePool(pool);

    // Update or create LP position
    const existingPosition = getUserLPPosition(poolId, walletAddress);
    if (existingPosition) {
      existingPosition.lpTokens += liquidityMinted;
      existingPosition.solDeposited += finalSolAmount;
      existingPosition.tokenDeposited += finalTokenAmount;
      updateLPPosition(existingPosition);
    } else {
      createLPPosition(poolId, walletAddress, liquidityMinted, finalSolAmount, finalTokenAmount);
    }

    console.log('Liquidity added:', { lpTokens: liquidityMinted, solAmount: finalSolAmount, tokenAmount: finalTokenAmount });

    return {
      success: true,
      lpTokensMinted: liquidityMinted,
      solDeposited: finalSolAmount,
      tokenDeposited: finalTokenAmount,
      pool
    };

  } catch (error) {
    console.error('Add liquidity failed:', error);
    throw error;
  }
};

/**
 * Remove liquidity from pool
 */
export const removeLiquidity = (poolId, walletAddress, lpTokens) => {
  try {
    const pool = getPool(poolId);
    if (!pool) throw new Error('Pool not found');

    const position = getUserLPPosition(poolId, walletAddress);
    if (!position) throw new Error('No LP position found');

    if (position.lpTokens < lpTokens) {
      throw new Error('Insufficient LP tokens');
    }

    // Calculate share of pool
    const share = lpTokens / pool.lpSupply;

    // Calculate amounts to return
    const solAmount = pool.baseReserve * share;
    const tokenAmount = pool.quoteReserve * share;

    // Update pool reserves
    pool.baseReserve -= solAmount;
    pool.quoteReserve -= tokenAmount;
    pool.lpSupply -= lpTokens;
    pool.liquidity = pool.baseReserve;

    // Save pool
    savePool(pool);

    // Update LP position
    position.lpTokens -= lpTokens;
    if (position.lpTokens === 0) {
      deleteLPPosition(poolId, walletAddress);
    } else {
      updateLPPosition(position);
    }

    console.log('Liquidity removed:', { solAmount, tokenAmount });

    return {
      success: true,
      solReturned: solAmount,
      tokenReturned: tokenAmount,
      lpTokensBurned: lpTokens,
      pool
    };

  } catch (error) {
    console.error('Remove liquidity failed:', error);
    throw error;
  }
};

/**
 * Create LP position for user
 */
const createLPPosition = (poolId, walletAddress, lpTokens, solAmount, tokenAmount) => {
  try {
    const positions = getUserPositions();

    const position = {
      poolId,
      wallet: walletAddress,
      lpTokens,
      solDeposited: solAmount,
      tokenDeposited: tokenAmount,
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };

    positions.push(position);
    localStorage.setItem(USER_POSITIONS_KEY, JSON.stringify(positions));

  } catch (error) {
    console.error('Failed to create LP position:', error);
  }
};

/**
 * Get all user positions
 */
const getUserPositions = () => {
  try {
    const data = localStorage.getItem(USER_POSITIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load user positions:', error);
    return [];
  }
};

/**
 * Get user LP position for specific pool
 */
export const getUserLPPosition = (poolId, walletAddress) => {
  try {
    const positions = getUserPositions();
    return positions.find(p => p.poolId === poolId && p.wallet === walletAddress) || null;
  } catch (error) {
    console.error('Failed to get user position:', error);
    return null;
  }
};

/**
 * Update LP position
 */
const updateLPPosition = (position) => {
  try {
    const positions = getUserPositions();
    const index = positions.findIndex(p => p.poolId === position.poolId && p.wallet === position.wallet);

    if (index !== -1) {
      positions[index] = { ...position, lastUpdated: Date.now() };
      localStorage.setItem(USER_POSITIONS_KEY, JSON.stringify(positions));
    }
  } catch (error) {
    console.error('Failed to update LP position:', error);
  }
};

/**
 * Delete LP position
 */
const deleteLPPosition = (poolId, walletAddress) => {
  try {
    const positions = getUserPositions();
    const filtered = positions.filter(p => !(p.poolId === poolId && p.wallet === walletAddress));
    localStorage.setItem(USER_POSITIONS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete LP position:', error);
  }
};

/**
 * Save trade record
 */
const saveTrade = (trade) => {
  try {
    const trades = getTrades();
    trades.unshift(trade);

    // Keep only last 10,000 trades
    if (trades.length > 10000) {
      trades.length = 10000;
    }

    localStorage.setItem(POOL_TRADES_KEY, JSON.stringify(trades));
  } catch (error) {
    console.error('Failed to save trade:', error);
  }
};

/**
 * Get all trades
 */
export const getTrades = (poolId = null) => {
  try {
    const data = localStorage.getItem(POOL_TRADES_KEY);
    const trades = data ? JSON.parse(data) : [];

    if (poolId) {
      return trades.filter(t => t.poolId === poolId);
    }

    return trades;
  } catch (error) {
    console.error('Failed to load trades:', error);
    return [];
  }
};

/**
 * Get recent trades for pool
 */
export const getRecentTrades = (poolId, limit = 20) => {
  try {
    const trades = getTrades(poolId);
    return trades.slice(0, limit);
  } catch (error) {
    console.error('Failed to get recent trades:', error);
    return [];
  }
};

/**
 * Delete pool
 */
export const deletePool = (poolId) => {
  try {
    const pools = getPools();
    const filtered = pools.filter(p => p.id !== poolId);
    localStorage.setItem(POOLS_STORAGE_KEY, JSON.stringify(filtered));

    console.log('Pool deleted');
    return true;
  } catch (error) {
    console.error('Failed to delete pool:', error);
    return false;
  }
};

/**
 * Clear all pools
 */
export const clearAllPools = () => {
  try {
    localStorage.removeItem(POOLS_STORAGE_KEY);
    localStorage.removeItem(POOL_TRADES_KEY);
    localStorage.removeItem(USER_POSITIONS_KEY);
    console.log('All pools cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear pools:', error);
    return false;
  }
};

export default {
  createLiquidityPool,
  getPools,
  getPool,
  getPoolByToken,
  simulateTrade,
  executeTrade,
  addLiquidity,
  removeLiquidity,
  getUserLPPosition,
  getTrades,
  getRecentTrades,
  deletePool,
  clearAllPools
};
