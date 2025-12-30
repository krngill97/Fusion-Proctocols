// ===========================================
// Fusion - Raydium Swap Service
// ===========================================

import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getHttpConnection } from '../../config/chainstack.js';
import { logger } from '../../shared/utils/logger.js';
import { solToLamports, lamportsToSol } from '../../shared/utils/helpers.js';
import { PROGRAM_IDS } from '../../config/constants.js';

const log = logger.withContext('RaydiumService');

// ------------------------------------
// Raydium API Configuration
// ------------------------------------

const RAYDIUM_API_BASE = 'https://api-v3.raydium.io';

// Native SOL mint
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ------------------------------------
// Get Pool Info
// ------------------------------------

/**
 * Get pool information from Raydium
 * @param {string} poolId - Pool ID or mint address
 * @returns {Promise<Object>} Pool info
 */
export const getPoolInfo = async (poolId) => {
  try {
    const response = await fetch(`${RAYDIUM_API_BASE}/pools/info/ids?ids=${poolId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch pool info');
    }

    const data = await response.json();

    if (!data.success || !data.data || data.data.length === 0) {
      return {
        success: false,
        error: 'Pool not found'
      };
    }

    return {
      success: true,
      pool: data.data[0]
    };

  } catch (error) {
    log.error('Raydium pool info error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// ------------------------------------
// Search Pools by Token
// ------------------------------------

/**
 * Search pools by token mint
 * @param {string} tokenMint - Token mint address
 * @returns {Promise<Object>} Pool list
 */
export const searchPoolsByToken = async (tokenMint) => {
  try {
    const response = await fetch(
      `${RAYDIUM_API_BASE}/pools/info/mint?mint1=${tokenMint}&mint2=${SOL_MINT}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=10&page=1`
    );
    
    if (!response.ok) {
      throw new Error('Failed to search pools');
    }

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: 'Failed to fetch pools'
      };
    }

    return {
      success: true,
      pools: data.data?.data || [],
      count: data.data?.count || 0
    };

  } catch (error) {
    log.error('Raydium pool search error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// ------------------------------------
// Get Swap Quote
// ------------------------------------

/**
 * Get swap quote from Raydium
 * @param {Object} params - Quote parameters
 * @returns {Promise<Object>} Quote data
 */
export const getQuote = async ({
  inputMint,
  outputMint,
  amount,
  slippageBps = 100
}) => {
  try {
    const slippage = slippageBps / 10000; // Convert bps to decimal

    const response = await fetch(
      `${RAYDIUM_API_BASE}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&txVersion=V0`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Raydium quote failed: ${error}`);
    }

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.msg || 'Quote failed'
      };
    }

    return {
      success: true,
      quote: data.data,
      inputAmount: data.data.inputAmount,
      outputAmount: data.data.outputAmount,
      priceImpact: data.data.priceImpactPct,
      minReceived: data.data.otherAmountThreshold
    };

  } catch (error) {
    log.error('Raydium quote error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// ------------------------------------
// Get Swap Transaction
// ------------------------------------

/**
 * Get swap transaction from Raydium
 * @param {Object} params - Transaction parameters
 * @returns {Promise<Object>} Transaction data
 */
export const getSwapTransaction = async ({
  quote,
  userPublicKey,
  priorityFee = 10000
}) => {
  try {
    const response = await fetch(`${RAYDIUM_API_BASE}/transaction/swap-base-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        computeUnitPriceMicroLamports: priorityFee.toString(),
        swapResponse: quote,
        txVersion: 'V0',
        wallet: userPublicKey,
        wrapSol: true,
        unwrapSol: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Raydium swap tx failed: ${error}`);
    }

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.msg || 'Transaction build failed'
      };
    }

    return {
      success: true,
      transactions: data.data
    };

  } catch (error) {
    log.error('Raydium swap transaction error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// ------------------------------------
// Execute Swap
// ------------------------------------

/**
 * Execute a swap on Raydium
 * @param {Object} params - Execution parameters
 * @returns {Promise<Object>} Execution result
 */
export const executeSwap = async ({
  inputMint,
  outputMint,
  amount,
  slippageBps = 100,
  wallet,
  priorityFee = 10000
}) => {
  try {
    log.info(`Executing Raydium swap: ${inputMint.slice(0, 8)}... -> ${outputMint.slice(0, 8)}...`);

    // 1. Get quote
    const quoteResult = await getQuote({
      inputMint,
      outputMint,
      amount,
      slippageBps
    });

    if (!quoteResult.success) {
      return quoteResult;
    }

    // 2. Get swap transaction
    const txResult = await getSwapTransaction({
      quote: quoteResult.quote,
      userPublicKey: wallet.publicKey.toBase58(),
      priorityFee
    });

    if (!txResult.success) {
      return txResult;
    }

    const connection = getHttpConnection();
    const signatures = [];

    // 3. Process each transaction (Raydium may return multiple)
    for (const txData of txResult.transactions) {
      const txBuf = Buffer.from(txData.transaction, 'base64');
      
      // Determine transaction type
      let transaction;
      try {
        // Try versioned transaction first
        const { VersionedTransaction } = await import('@solana/web3.js');
        transaction = VersionedTransaction.deserialize(txBuf);
        transaction.sign([wallet]);
      } catch {
        // Fall back to legacy transaction
        transaction = Transaction.from(txBuf);
        transaction.sign(wallet);
      }

      // Send transaction
      const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      });

      signatures.push(signature);
      log.info(`Raydium transaction sent: ${signature}`);

      // Confirm
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
    }

    log.info(`Raydium swap confirmed: ${signatures.join(', ')}`);

    return {
      success: true,
      signatures,
      signature: signatures[signatures.length - 1], // Primary signature
      inputAmount: quoteResult.inputAmount,
      outputAmount: quoteResult.outputAmount,
      priceImpact: quoteResult.priceImpact
    };

  } catch (error) {
    log.error('Raydium swap execution error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// ------------------------------------
// Buy Token
// ------------------------------------

/**
 * Buy a token with SOL via Raydium
 * @param {Object} params - Buy parameters
 * @returns {Promise<Object>} Buy result
 */
export const buyToken = async ({
  tokenMint,
  solAmount,
  slippageBps = 100,
  wallet,
  priorityFee = 10000
}) => {
  const lamports = solToLamports(solAmount);

  return executeSwap({
    inputMint: SOL_MINT,
    outputMint: tokenMint,
    amount: lamports,
    slippageBps,
    wallet,
    priorityFee
  });
};

// ------------------------------------
// Sell Token
// ------------------------------------

/**
 * Sell a token for SOL via Raydium
 * @param {Object} params - Sell parameters
 * @returns {Promise<Object>} Sell result
 */
export const sellToken = async ({
  tokenMint,
  tokenAmount,
  slippageBps = 100,
  wallet,
  priorityFee = 10000
}) => {
  return executeSwap({
    inputMint: tokenMint,
    outputMint: SOL_MINT,
    amount: tokenAmount,
    slippageBps,
    wallet,
    priorityFee
  });
};

// ------------------------------------
// Get Token Price via Pool
// ------------------------------------

/**
 * Get token price from Raydium pools
 * @param {string} tokenMint - Token mint address
 * @returns {Promise<Object>} Price data
 */
export const getTokenPrice = async (tokenMint) => {
  try {
    // Search for pools with this token
    const poolsResult = await searchPoolsByToken(tokenMint);

    if (!poolsResult.success || poolsResult.pools.length === 0) {
      return {
        success: false,
        error: 'No pools found for token'
      };
    }

    // Get best pool (highest liquidity)
    const bestPool = poolsResult.pools[0];

    // Calculate price from pool reserves
    const price = bestPool.price || 0;

    return {
      success: true,
      price,
      pool: {
        id: bestPool.id,
        liquidity: bestPool.tvl,
        volume24h: bestPool.day?.volume
      }
    };

  } catch (error) {
    log.error('Raydium price error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// ------------------------------------
// Simulate Swap
// ------------------------------------

/**
 * Simulate a swap without executing
 * @param {Object} params - Simulation parameters
 * @returns {Promise<Object>} Simulation result
 */
export const simulateSwap = async ({
  inputMint,
  outputMint,
  amount,
  slippageBps = 100
}) => {
  const quoteResult = await getQuote({
    inputMint,
    outputMint,
    amount,
    slippageBps
  });

  if (!quoteResult.success) {
    return quoteResult;
  }

  const inputAmount = inputMint === SOL_MINT 
    ? lamportsToSol(quoteResult.inputAmount) 
    : quoteResult.inputAmount;
    
  const outputAmount = outputMint === SOL_MINT 
    ? lamportsToSol(quoteResult.outputAmount) 
    : quoteResult.outputAmount;

  return {
    success: true,
    simulation: {
      inputMint,
      outputMint,
      inputAmount,
      outputAmount,
      priceImpact: parseFloat(quoteResult.priceImpact || 0),
      minimumReceived: quoteResult.minReceived,
      dex: 'raydium'
    }
  };
};

export default {
  getPoolInfo,
  searchPoolsByToken,
  getQuote,
  getSwapTransaction,
  executeSwap,
  buyToken,
  sellToken,
  getTokenPrice,
  simulateSwap,
  SOL_MINT
};
