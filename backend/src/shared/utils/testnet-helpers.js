// ===========================================
// Fusion - Testnet Helper Utilities
// Address generation and trading calculations
// ===========================================

import crypto from 'crypto';

/**
 * Generate a simulated Solana mint address
 * Creates a Base58-encoded 44-character string
 */
export const generateMintAddress = () => {
  const bytes = crypto.randomBytes(32);
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars[bytes[i % 32] % chars.length];
  }
  return result;
};

/**
 * Generate a simulated Solana wallet address
 * Creates a Base58-encoded 44-character string
 */
export const generateWalletAddress = () => {
  return generateMintAddress(); // Same format as mint addresses
};

/**
 * Generate a simulated Solana transaction signature
 * Creates a Base58-encoded 88-character string
 */
export const generateTxSignature = () => {
  const bytes = crypto.randomBytes(64);
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 88; i++) {
    result += chars[bytes[i % 64] % chars.length];
  }
  return result;
};

/**
 * Fee structure constants
 */
export const FEE_CONFIG = {
  GAS_FEE: 0.000005,           // Simulated Solana gas fee
  PLATFORM_FEE_PERCENT: 0.01,   // 1%
  LIQUIDITY_FEE_PERCENT: 0.03,  // 3%
  BASE_SLIPPAGE_PERCENT: 0.005  // 0.5% base slippage
};

/**
 * Calculate transaction fees
 * @param {number} solAmount - Amount in SOL
 * @param {number} priceImpact - Price impact percentage (default 0)
 * @returns {Object} Fee breakdown
 */
export const calculateTransactionFees = (solAmount, priceImpact = 0) => {
  const gasFee = FEE_CONFIG.GAS_FEE;
  const platformFee = solAmount * FEE_CONFIG.PLATFORM_FEE_PERCENT;
  const liquidityFee = solAmount * FEE_CONFIG.LIQUIDITY_FEE_PERCENT;

  // Slippage increases with price impact
  const slippageMultiplier = 1 + Math.abs(priceImpact) / 10;
  const slippage = solAmount * FEE_CONFIG.BASE_SLIPPAGE_PERCENT * slippageMultiplier;

  const totalFee = gasFee + platformFee + liquidityFee + slippage;

  return {
    gasFee,
    platformFee,
    liquidityFee,
    slippage,
    totalFee
  };
};

/**
 * Calculate bonding curve price at a given progress
 * @param {number} basePrice - Starting price
 * @param {number} maxPrice - Maximum price
 * @param {number} progress - Progress along curve (0 to 1)
 * @returns {number} Price at progress point
 */
export const calculateBondingCurvePrice = (basePrice, maxPrice, progress) => {
  const priceRange = maxPrice - basePrice;
  return basePrice + (progress * priceRange);
};

/**
 * Calculate price impact for a trade
 * @param {number} tokenAmount - Amount of tokens being traded
 * @param {number} totalSupply - Total token supply
 * @returns {number} Price impact as percentage
 */
export const calculatePriceImpact = (tokenAmount, totalSupply) => {
  // Simple linear impact based on trade size relative to supply
  return (tokenAmount / totalSupply) * 100;
};

/**
 * Calculate market cap
 * @param {number} circulatingSupply - Current circulating supply
 * @param {number} currentPrice - Current token price
 * @returns {number} Market cap in SOL
 */
export const calculateMarketCap = (circulatingSupply, currentPrice) => {
  return circulatingSupply * currentPrice;
};

/**
 * Generate random trade size within bounds
 * @param {number} minSize - Minimum trade size
 * @param {number} maxSize - Maximum trade size
 * @param {number} remainingBudget - Available budget
 * @returns {number} Random trade size
 */
export const generateRandomTradeSize = (minSize, maxSize, remainingBudget) => {
  const effectiveMax = Math.min(maxSize, remainingBudget);
  if (effectiveMax <= minSize) return minSize;
  return minSize + Math.random() * (effectiveMax - minSize);
};

/**
 * Determine trade direction based on buy ratio
 * @param {number} buyRatio - Probability of buy (0 to 1)
 * @returns {string} 'buy' or 'sell'
 */
export const determineTradeDirection = (buyRatio = 0.7) => {
  return Math.random() < buyRatio ? 'buy' : 'sell';
};

/**
 * Format SOL amount for display
 * @param {number} amount - Amount in SOL
 * @param {number} decimals - Decimal places (default 6)
 * @returns {string} Formatted amount
 */
export const formatSOL = (amount, decimals = 6) => {
  return amount.toFixed(decimals);
};

/**
 * Sleep utility for delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validate Solana-style address format
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid format
 */
export const isValidAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;

  const validChars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  for (const char of address) {
    if (!validChars.includes(char)) return false;
  }
  return true;
};

export default {
  generateMintAddress,
  generateWalletAddress,
  generateTxSignature,
  FEE_CONFIG,
  calculateTransactionFees,
  calculateBondingCurvePrice,
  calculatePriceImpact,
  calculateMarketCap,
  generateRandomTradeSize,
  determineTradeDirection,
  formatSOL,
  sleep,
  isValidAddress
};
