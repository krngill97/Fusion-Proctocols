// ===========================================
// Fusion - Volume Simulator Service
// Simulates volume bot activity for testing
// ===========================================

import TestnetToken from './testnet-token.model.js';
import TestnetVolumeSession from './testnet-volume-session.model.js';
import TestnetTradeService from './testnet-trade.service.js';
import TestnetHolder from './testnet-holder.model.js';
import crypto from 'crypto';

/**
 * Generate simulated wallet address
 */
const generateWalletAddress = () => {
  const bytes = crypto.randomBytes(32);
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars[bytes[i % 32] % chars.length];
  }
  return result;
};

/**
 * Random number in range
 */
const randomInRange = (min, max) => {
  return Math.random() * (max - min) + min;
};

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class VolumeSimulatorService {
  constructor() {
    this.activeSessions = new Map();
  }

  /**
   * Start a new volume simulation session
   */
  async startSession({ tokenMint, creator, config }) {
    // Check if user already has active session
    const hasActive = await TestnetVolumeSession.hasActiveSession(creator);
    if (hasActive) {
      throw new Error('You already have an active volume session');
    }

    // Get token
    const token = await TestnetToken.findOne({ mint: tokenMint });
    if (!token) {
      throw new Error('Token not found');
    }

    // Generate wallets
    const wallets = [];
    for (let i = 0; i < config.walletCount; i++) {
      wallets.push({
        address: generateWalletAddress(),
        balance: 0,
        tokenBalance: 0
      });
    }

    // Create session
    const session = await TestnetVolumeSession.create({
      sessionName: `Volume Test - ${token.symbol} - ${new Date().toLocaleString()}`,
      tokenMint,
      tokenSymbol: token.symbol,
      creator,
      config,
      status: 'pending',
      metrics: {
        startPrice: token.bondingCurve.currentPrice,
        totalVolume: 0,
        totalTrades: 0,
        buyTrades: 0,
        sellTrades: 0
      },
      generatedWallets: wallets,
      network: 'devnet'
    });

    // Start the simulation in background
    this.runSimulation(session._id, config);

    return session;
  }

  /**
   * Run the simulation loop
   */
  async runSimulation(sessionId, config) {
    try {
      const session = await TestnetVolumeSession.findById(sessionId);
      if (!session) return;

      // Mark as running
      await session.start();
      this.activeSessions.set(sessionId.toString(), true);

      const {
        budget,
        duration,
        tradeInterval,
        minTradeSize,
        maxTradeSize,
        walletCount,
        buyRatio
      } = config;

      const wallets = session.generatedWallets.map(w => w.address);
      const endTime = Date.now() + (duration * 60 * 1000);
      let remainingBudget = budget;
      let tradeIndex = 0;

      // Distribute initial budget to wallets (for sells later)
      const walletBalances = new Map();
      wallets.forEach(w => {
        walletBalances.set(w, { sol: budget / walletCount, tokens: 0 });
      });

      // Main trading loop
      while (Date.now() < endTime && remainingBudget > minTradeSize) {
        // Check if session was stopped
        const currentSession = await TestnetVolumeSession.findById(sessionId);
        if (!currentSession || currentSession.status !== 'running') {
          break;
        }

        try {
          // Determine trade type based on ratio
          const isBuy = Math.random() < buyRatio;

          // Select random wallet
          const walletIndex = tradeIndex % wallets.length;
          const wallet = wallets[walletIndex];
          const walletBal = walletBalances.get(wallet);

          // Determine trade size
          let tradeSize = randomInRange(minTradeSize, maxTradeSize);
          tradeSize = Math.min(tradeSize, remainingBudget);

          let trade;

          if (isBuy && walletBal.sol >= tradeSize) {
            // Execute buy
            const result = await TestnetTradeService.executeTrade({
              tokenMint: session.tokenMint,
              wallet,
              type: 'buy',
              amount: tradeSize,
              isVolumeBot: true,
              volumeSessionId: sessionId
            });

            trade = result.trade;

            // Update wallet balances
            walletBal.sol -= tradeSize;
            walletBal.tokens += trade.tokenAmount;

            // Update remaining budget
            remainingBudget -= tradeSize;

          } else if (!isBuy && walletBal.tokens > 0) {
            // Execute sell - sell some portion of tokens
            const sellAmount = walletBal.tokens * randomInRange(0.1, 0.5);

            if (sellAmount > 0) {
              const result = await TestnetTradeService.executeTrade({
                tokenMint: session.tokenMint,
                wallet,
                type: 'sell',
                amount: sellAmount,
                isVolumeBot: true,
                volumeSessionId: sessionId
              });

              trade = result.trade;

              // Update wallet balances
              walletBal.tokens -= sellAmount;
              walletBal.sol += trade.solAmount - trade.fees.totalFee;
            }
          } else {
            // Can't execute this trade type, try the opposite
            if (!isBuy && walletBal.sol >= tradeSize) {
              // Do a buy instead
              const result = await TestnetTradeService.executeTrade({
                tokenMint: session.tokenMint,
                wallet,
                type: 'buy',
                amount: tradeSize,
                isVolumeBot: true,
                volumeSessionId: sessionId
              });

              trade = result.trade;
              walletBal.sol -= tradeSize;
              walletBal.tokens += trade.tokenAmount;
              remainingBudget -= tradeSize;
            }
          }

          // Record trade if successful
          if (trade) {
            // Get updated token for price
            const updatedToken = await TestnetToken.findOne({ mint: session.tokenMint });

            // Record in session
            session.recordTrade(trade);
            session.metrics.endPrice = updatedToken.bondingCurve.currentPrice;

            // Update wallet in session
            const walletEntry = session.generatedWallets.find(w => w.address === wallet);
            if (walletEntry) {
              walletEntry.balance = walletBal.sol;
              walletEntry.tokenBalance = walletBal.tokens;
            }

            await session.save();
          }

          tradeIndex++;

        } catch (tradeError) {
          console.error('Trade execution error:', tradeError);
          session.recordError(tradeError, 'trade_execution');
          await session.save();
        }

        // Wait for next trade
        await sleep(tradeInterval * 1000);
      }

      // Update holder distribution
      const distribution = await TestnetHolder.getDistribution(session.tokenMint);
      session.holderDistribution = distribution.holders.slice(0, 20).map(h => ({
        wallet: h.wallet,
        balance: h.balance,
        percentage: h.percentage
      }));
      session.metrics.uniqueHolders = distribution.holders.length;
      session.metrics.activeHolders = distribution.holders.filter(h => h.balance > 0).length;

      // Complete session
      await session.complete();
      this.activeSessions.delete(sessionId.toString());

    } catch (error) {
      console.error('Simulation error:', error);

      const session = await TestnetVolumeSession.findById(sessionId);
      if (session) {
        await session.fail(error);
      }
      this.activeSessions.delete(sessionId.toString());
    }
  }

  /**
   * Stop a running session
   */
  async stopSession(sessionId) {
    const session = await TestnetVolumeSession.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (!['running', 'paused'].includes(session.status)) {
      throw new Error('Session is not active');
    }

    // Update holder distribution before stopping
    const distribution = await TestnetHolder.getDistribution(session.tokenMint);
    session.holderDistribution = distribution.holders.slice(0, 20).map(h => ({
      wallet: h.wallet,
      balance: h.balance,
      percentage: h.percentage
    }));
    session.metrics.uniqueHolders = distribution.holders.length;
    session.metrics.activeHolders = distribution.holders.filter(h => h.balance > 0).length;

    await session.stop();
    this.activeSessions.delete(sessionId.toString());

    return session;
  }

  /**
   * Pause a running session
   */
  async pauseSession(sessionId) {
    const session = await TestnetVolumeSession.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'running') {
      throw new Error('Session is not running');
    }

    await session.pause();
    return session;
  }

  /**
   * Resume a paused session
   */
  async resumeSession(sessionId) {
    const session = await TestnetVolumeSession.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'paused') {
      throw new Error('Session is not paused');
    }

    await session.resume();

    // Restart simulation
    this.runSimulation(sessionId, session.config);

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    const session = await TestnetVolumeSession.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return session;
  }

  /**
   * Get sessions for creator
   */
  async getSessionsByCreator(creator, options = {}) {
    return TestnetVolumeSession.getByCreator(creator, options);
  }

  /**
   * Get sessions for token
   */
  async getSessionsByToken(tokenMint, options = {}) {
    return TestnetVolumeSession.getByToken(tokenMint, options);
  }

  /**
   * Get creator stats
   */
  async getCreatorStats(creator) {
    return TestnetVolumeSession.getCreatorStats(creator);
  }

  /**
   * Check if session is active
   */
  isSessionActive(sessionId) {
    return this.activeSessions.has(sessionId.toString());
  }
}

export default new VolumeSimulatorService();
