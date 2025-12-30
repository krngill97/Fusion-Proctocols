// ===========================================
// Fusion - Testnet Trade Service
// Bonding curve trading logic with fee simulation
// ===========================================

import TestnetToken from './testnet-token.model.js';
import TestnetTrade from './testnet-trade.model.js';
import TestnetHolder from './testnet-holder.model.js';
import crypto from 'crypto';

/**
 * Generate simulated transaction signature
 */
const generateTxSignature = () => {
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
const FEE_CONFIG = {
  GAS_FEE: 0.000005, // Simulated Solana gas fee
  PLATFORM_FEE_PERCENT: 0.01, // 1%
  LIQUIDITY_FEE_PERCENT: 0.03, // 3%
  BASE_SLIPPAGE_PERCENT: 0.005 // 0.5% base slippage
};

class TestnetTradeService {

  /**
   * Calculate trading fees
   */
  calculateFees(solAmount, priceImpact = 0) {
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
  }

  /**
   * Calculate bonding curve price for buy
   */
  calculateBuyPrice(token, solAmount) {
    const { bondingCurve, totalSupply } = token;
    const { basePrice, maxPrice, reserveTokens } = bondingCurve;

    // Calculate current progress on bonding curve
    const currentProgress = (totalSupply - reserveTokens) / totalSupply;
    const priceRange = maxPrice - basePrice;
    const startPrice = basePrice + (currentProgress * priceRange);

    // Estimate fees first
    const estimatedFees = this.calculateFees(solAmount, 0);
    const netSolAmount = solAmount - estimatedFees.totalFee;

    // Calculate how many tokens we can buy with this SOL
    // Using integration of linear bonding curve
    // For linear curve: price = basePrice + (progress * priceRange)
    // Average price for a range is midpoint

    // Iterative approach for more accuracy
    let tokenAmount = 0;
    let remainingSol = netSolAmount;
    let tempProgress = currentProgress;
    const step = totalSupply / 10000; // Small steps for accuracy

    while (remainingSol > 0 && tokenAmount < reserveTokens) {
      const currentStepPrice = basePrice + (tempProgress * priceRange);
      const stepCost = currentStepPrice * step;

      if (stepCost > remainingSol) {
        // Partial step
        tokenAmount += remainingSol / currentStepPrice;
        break;
      }

      tokenAmount += step;
      remainingSol -= stepCost;
      tempProgress = (totalSupply - reserveTokens + tokenAmount) / totalSupply;
    }

    // Cap at available tokens
    tokenAmount = Math.min(tokenAmount, reserveTokens);

    // Calculate end progress and price
    const endProgress = (totalSupply - reserveTokens + tokenAmount) / totalSupply;
    const endPrice = basePrice + (endProgress * priceRange);
    const avgPrice = (startPrice + endPrice) / 2;

    // Calculate price impact
    const priceImpact = ((endPrice - startPrice) / startPrice) * 100;

    // Recalculate fees with actual price impact
    const finalFees = this.calculateFees(solAmount, priceImpact);

    return {
      tokenAmount,
      avgPrice,
      startPrice,
      endPrice,
      priceImpact,
      fees: finalFees,
      netSolAmount: solAmount - finalFees.totalFee
    };
  }

  /**
   * Calculate bonding curve price for sell
   */
  calculateSellPrice(token, tokenAmount) {
    const { bondingCurve, totalSupply } = token;
    const { basePrice, maxPrice, reserveTokens, reserveSOL } = bondingCurve;

    // Validate token amount
    const currentSupply = totalSupply - reserveTokens;
    if (tokenAmount > currentSupply) {
      throw new Error('Insufficient tokens in circulation');
    }

    // Calculate current progress on bonding curve
    const currentProgress = currentSupply / totalSupply;
    const priceRange = maxPrice - basePrice;
    const startPrice = basePrice + (currentProgress * priceRange);

    // Calculate end progress and price after sell
    const endProgress = (currentSupply - tokenAmount) / totalSupply;
    const endPrice = basePrice + (endProgress * priceRange);
    const avgPrice = (startPrice + endPrice) / 2;

    // Calculate SOL returned
    const grossSolAmount = avgPrice * tokenAmount;

    // Calculate price impact (negative for sells)
    const priceImpact = ((endPrice - startPrice) / startPrice) * 100;

    // Calculate fees
    const fees = this.calculateFees(grossSolAmount, priceImpact);
    const netSolAmount = grossSolAmount - fees.totalFee;

    return {
      solAmount: netSolAmount,
      grossSolAmount,
      avgPrice,
      startPrice,
      endPrice,
      priceImpact,
      fees
    };
  }

  /**
   * Estimate trade without executing
   */
  async estimateTrade({ tokenMint, type, amount }) {
    const token = await TestnetToken.findOne({ mint: tokenMint });

    if (!token) {
      throw new Error('Token not found');
    }

    if (type === 'buy') {
      const estimate = this.calculateBuyPrice(token, amount);
      return {
        type: 'buy',
        inputAmount: amount,
        outputAmount: estimate.tokenAmount,
        pricePerToken: estimate.avgPrice,
        priceImpact: estimate.priceImpact,
        ...estimate.fees,
        feePercentage: (estimate.fees.totalFee / amount) * 100
      };
    } else {
      const estimate = this.calculateSellPrice(token, amount);
      return {
        type: 'sell',
        inputAmount: amount,
        outputAmount: estimate.solAmount,
        pricePerToken: estimate.avgPrice,
        priceImpact: estimate.priceImpact,
        ...estimate.fees,
        feePercentage: (estimate.fees.totalFee / estimate.grossSolAmount) * 100
      };
    }
  }

  /**
   * Execute a trade
   */
  async executeTrade({ tokenMint, wallet, type, amount, isVolumeBot = false, volumeSessionId = null }) {
    const token = await TestnetToken.findOne({ mint: tokenMint });

    if (!token) {
      throw new Error('Token not found');
    }

    let tradeDetails;
    let tokenAmount;
    let solAmount;
    let price;
    let fees;
    let priceImpact;

    if (type === 'buy') {
      // Calculate buy details
      const buyCalc = this.calculateBuyPrice(token, amount);

      // Validate
      if (buyCalc.tokenAmount <= 0) {
        throw new Error('Trade amount too small');
      }

      if (buyCalc.tokenAmount > token.bondingCurve.reserveTokens) {
        throw new Error('Insufficient tokens available');
      }

      tokenAmount = buyCalc.tokenAmount;
      solAmount = amount;
      price = buyCalc.avgPrice;
      fees = buyCalc.fees;
      priceImpact = buyCalc.priceImpact;

      // Update token state
      token.updatePriceAfterTrade(true, tokenAmount, buyCalc.netSolAmount);

    } else {
      // Validate holder has enough tokens
      const holder = await TestnetHolder.findOne({ tokenMint, wallet });

      if (!holder || holder.balance < amount) {
        throw new Error('Insufficient token balance');
      }

      // Calculate sell details
      const sellCalc = this.calculateSellPrice(token, amount);

      tokenAmount = amount;
      solAmount = sellCalc.grossSolAmount;
      price = sellCalc.avgPrice;
      fees = sellCalc.fees;
      priceImpact = sellCalc.priceImpact;

      // Update token state
      token.updatePriceAfterTrade(false, tokenAmount, sellCalc.netSolAmount);
    }

    // Update token volume and transaction count
    token.addVolume(solAmount);
    await token.save();

    // Create trade record
    const signature = generateTxSignature();
    const trade = await TestnetTrade.create({
      signature,
      tokenMint,
      tokenSymbol: token.symbol,
      wallet,
      type,
      solAmount,
      tokenAmount,
      price,
      priceImpact,
      slippagePercent: (fees.slippage / solAmount) * 100,
      fees,
      isVolumeBot,
      volumeSessionId,
      status: 'confirmed',
      network: 'devnet',
      timestamp: new Date()
    });

    // Update holder
    await this.updateHolder({
      tokenMint,
      wallet,
      tokenAmount,
      solAmount: type === 'buy' ? solAmount : (solAmount - fees.totalFee),
      type,
      currentPrice: token.bondingCurve.currentPrice,
      isVolumeBot
    });

    // Update token holder count
    const activeHolders = await TestnetHolder.getActiveCount(tokenMint);
    token.holders = activeHolders;
    await token.save();

    return {
      trade,
      token: {
        mint: token.mint,
        symbol: token.symbol,
        currentPrice: token.bondingCurve.currentPrice,
        marketCap: token.marketCap,
        holders: token.holders
      }
    };
  }

  /**
   * Update holder balance and stats
   */
  async updateHolder({ tokenMint, wallet, tokenAmount, solAmount, type, currentPrice, isVolumeBot = false }) {
    let holder = await TestnetHolder.getOrCreate(tokenMint, wallet);

    if (type === 'buy') {
      holder.processBuy(tokenAmount, solAmount, currentPrice);
    } else {
      holder.processSell(tokenAmount, solAmount, currentPrice);
    }

    holder.isVolumeBot = isVolumeBot;
    holder.updateUnrealizedPnL(currentPrice);

    await holder.save();

    return holder;
  }

  /**
   * Get trades for a token
   */
  async getTokenTrades(tokenMint, options = {}) {
    return TestnetTrade.getByToken(tokenMint, options);
  }

  /**
   * Get recent trades for a token
   */
  async getRecentTrades(tokenMint, limit = 20) {
    return TestnetTrade.getRecentByToken(tokenMint, limit);
  }

  /**
   * Get trades for a wallet
   */
  async getWalletTrades(wallet, options = {}) {
    return TestnetTrade.getByWallet(wallet, options);
  }

  /**
   * Get trade statistics for a token
   */
  async getTokenTradeStats(tokenMint) {
    return TestnetTrade.getTokenStats(tokenMint);
  }

  /**
   * Get 24h volume for a token
   */
  async get24hVolume(tokenMint) {
    return TestnetTrade.get24hVolume(tokenMint);
  }
}

export default new TestnetTradeService();
