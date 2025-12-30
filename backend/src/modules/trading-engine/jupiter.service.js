// ===========================================
// Fusion - Jupiter Swap Service
// ===========================================

import { PublicKey, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { getHttpConnection } from '../../config/chainstack.js';
import { logger } from '../../shared/utils/logger.js';
import { solToLamports, lamportsToSol, sleep } from '../../shared/utils/helpers.js';

const log = logger.withContext('JupiterService');

// ------------------------------------
// Jupiter API Configuration
// ------------------------------------

const JUPITER_API_BASE = 'https://quote-api.jup.ag/v6';
const JUPITER_PRICE_API = 'https://price.jup.ag/v6';

// Native SOL mint
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ------------------------------------
// Get Quote
// ------------------------------------

/**
 * Get a swap quote from Jupiter
 * @param {Object} params - Quote parameters
 * @param {string} params.inputMint - Input token mint address
 * @param {string} params.outputMint - Output token mint address
 * @param {number} params.amount - Amount in smallest unit (lamports for SOL)
 * @param {number} params.slippageBps - Slippage tolerance in basis points (100 = 1%)
 * @returns {Promise<Object>} Quote data
 */
export const getQuote = async ({
  inputMint,
  outputMint,
  amount,
  slippageBps = 100,
  swapMode = 'ExactIn',
  onlyDirectRoutes = false,
  asLegacyTransaction = false
}) => {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      swapMode,
      onlyDirectRoutes: onlyDirectRoutes.toString(),
      asLegacyTransaction: asLegacyTransaction.toString()
    });

    const response = await fetch(`${JUPITER_API_BASE}/quote?${params}`);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter quote failed: ${error}`);
    }

    const quote = await response.json();

    log.debug(`Quote received: ${lamportsToSol(quote.inAmount)} -> ${quote.outAmount} (${quote.routePlan?.length || 0} routes)`);

    return {
      success: true,
      quote,
      inputAmount: quote.inAmount,
      outputAmount: quote.outAmount,
      priceImpactPct: quote.priceImpactPct,
      routePlan: quote.routePlan,
      otherAmountThreshold: quote.otherAmountThreshold
    };

  } catch (error) {
    log.error('Jupiter quote error:', error.message);
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
 * Get swap transaction from Jupiter
 * @param {Object} params - Swap parameters
 * @param {Object} params.quote - Quote from getQuote
 * @param {string} params.userPublicKey - User's wallet public key
 * @param {boolean} params.wrapUnwrapSOL - Auto wrap/unwrap SOL
 * @param {number} params.priorityFee - Priority fee in micro-lamports
 * @returns {Promise<Object>} Swap transaction data
 */
export const getSwapTransaction = async ({
  quote,
  userPublicKey,
  wrapUnwrapSOL = true,
  priorityFee = 10000,
  asLegacyTransaction = false
}) => {
  try {
    const response = await fetch(`${JUPITER_API_BASE}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: wrapUnwrapSOL,
        computeUnitPriceMicroLamports: priorityFee,
        asLegacyTransaction,
        dynamicComputeUnitLimit: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter swap failed: ${error}`);
    }

    const swapData = await response.json();

    return {
      success: true,
      swapTransaction: swapData.swapTransaction,
      lastValidBlockHeight: swapData.lastValidBlockHeight
    };

  } catch (error) {
    log.error('Jupiter swap transaction error:', error.message);
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
 * Execute a swap using Jupiter
 * @param {Object} params - Execution parameters
 * @param {string} params.inputMint - Input token mint
 * @param {string} params.outputMint - Output token mint
 * @param {number} params.amount - Amount in smallest unit
 * @param {number} params.slippageBps - Slippage in basis points
 * @param {Object} params.wallet - Wallet with secretKey for signing
 * @param {number} params.priorityFee - Priority fee in micro-lamports
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
    log.info(`Executing Jupiter swap: ${inputMint.slice(0, 8)}... -> ${outputMint.slice(0, 8)}...`);

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
    const swapResult = await getSwapTransaction({
      quote: quoteResult.quote,
      userPublicKey: wallet.publicKey.toBase58(),
      priorityFee
    });

    if (!swapResult.success) {
      return swapResult;
    }

    // 3. Deserialize and sign transaction
    const connection = getHttpConnection();
    const swapTransactionBuf = Buffer.from(swapResult.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // Sign with wallet
    transaction.sign([wallet]);

    // 4. Send transaction
    const txSignature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true,
      maxRetries: 3
    });

    log.info(`Swap transaction sent: ${txSignature}`);

    // 5. Confirm transaction
    const confirmation = await connection.confirmTransaction({
      signature: txSignature,
      blockhash: transaction.message.recentBlockhash,
      lastValidBlockHeight: swapResult.lastValidBlockHeight
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    log.info(`Swap confirmed: ${txSignature}`);

    return {
      success: true,
      signature: txSignature,
      inputAmount: quoteResult.inputAmount,
      outputAmount: quoteResult.outputAmount,
      priceImpact: quoteResult.priceImpactPct
    };

  } catch (error) {
    log.error('Jupiter swap execution error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// ------------------------------------
// Buy Token (SOL -> Token)
// ------------------------------------

/**
 * Buy a token with SOL
 * @param {Object} params - Buy parameters
 * @param {string} params.tokenMint - Token to buy
 * @param {number} params.solAmount - Amount of SOL to spend
 * @param {number} params.slippageBps - Slippage tolerance
 * @param {Object} params.wallet - Wallet for signing
 * @param {number} params.priorityFee - Priority fee
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
// Sell Token (Token -> SOL)
// ------------------------------------

/**
 * Sell a token for SOL
 * @param {Object} params - Sell parameters
 * @param {string} params.tokenMint - Token to sell
 * @param {number} params.tokenAmount - Amount of tokens to sell (in smallest unit)
 * @param {number} params.slippageBps - Slippage tolerance
 * @param {Object} params.wallet - Wallet for signing
 * @param {number} params.priorityFee - Priority fee
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
// Get Token Price
// ------------------------------------

/**
 * Get token price from Jupiter
 * @param {string|string[]} mints - Token mint(s) to get price for
 * @returns {Promise<Object>} Price data
 */
export const getTokenPrice = async (mints) => {
  try {
    const mintList = Array.isArray(mints) ? mints.join(',') : mints;
    
    const response = await fetch(`${JUPITER_PRICE_API}/price?ids=${mintList}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch price');
    }

    const data = await response.json();

    return {
      success: true,
      prices: data.data
    };

  } catch (error) {
    log.error('Jupiter price error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// ------------------------------------
// Get Token Info
// ------------------------------------

/**
 * Get token info from Jupiter
 * @param {string} mint - Token mint address
 * @returns {Promise<Object>} Token info
 */
export const getTokenInfo = async (mint) => {
  try {
    const response = await fetch(`https://tokens.jup.ag/token/${mint}`);
    
    if (!response.ok) {
      return {
        success: false,
        error: 'Token not found'
      };
    }

    const data = await response.json();

    return {
      success: true,
      token: {
        address: data.address,
        symbol: data.symbol,
        name: data.name,
        decimals: data.decimals,
        logoURI: data.logoURI
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// ------------------------------------
// Simulate Swap (Quote Only)
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
      priceImpact: parseFloat(quoteResult.priceImpactPct),
      minimumReceived: quoteResult.otherAmountThreshold,
      routes: quoteResult.routePlan?.length || 0
    }
  };
};

export default {
  getQuote,
  getSwapTransaction,
  executeSwap,
  buyToken,
  sellToken,
  getTokenPrice,
  getTokenInfo,
  simulateSwap,
  SOL_MINT
};
