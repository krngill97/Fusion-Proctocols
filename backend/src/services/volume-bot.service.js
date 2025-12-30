/**
 * Volume Bot Service
 * Generates real on-chain trading volume for tokens
 */

import { Keypair, PublicKey } from '@solana/web3.js';
import tradingService from './trading.service.js';
import solanaConnection from './solana-connection.js';

class VolumeBotService {
  constructor() {
    this.activeSessions = new Map();
    this.sessionStats = new Map();
  }

  /**
   * Start volume generation session
   */
  async startSession({
    tokenMint,
    targetVolume,
    durationMinutes,
    tradesPerMinute = 2,
    minTradeSize = 0.01,
    maxTradeSize = 0.1,
    walletPrivateKeys = [],
    network = 'devnet',
  }) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[Volume Bot] Starting session: ${sessionId}`);
    console.log(`[Volume Bot] Token: ${tokenMint}`);
    console.log(`[Volume Bot] Target: ${targetVolume} SOL`);
    console.log(`[Volume Bot] Duration: ${durationMinutes} minutes`);

    // Create keypairs from private keys or generate new ones
    const wallets = walletPrivateKeys.length > 0
      ? walletPrivateKeys.map(pk => solanaConnection.keypairFromPrivateKey(pk))
      : this.generateWallets(5); // Generate 5 maker wallets by default

    const session = {
      id: sessionId,
      tokenMint,
      targetVolume,
      durationMinutes,
      tradesPerMinute,
      minTradeSize,
      maxTradeSize,
      wallets,
      network,
      startTime: new Date(),
      endTime: new Date(Date.now() + durationMinutes * 60 * 1000),
      status: 'running',
      trades: [],
      stats: {
        totalVolume: 0,
        tradesExecuted: 0,
        successfulTrades: 0,
        failedTrades: 0,
      },
    };

    this.activeSessions.set(sessionId, session);
    this.sessionStats.set(sessionId, session.stats);

    // Start the volume generation loop
    this.runVolumeGeneration(sessionId);

    return {
      sessionId,
      status: 'running',
      wallets: wallets.map(w => w.publicKey.toBase58()),
      startTime: session.startTime,
      endTime: session.endTime,
    };
  }

  /**
   * Run volume generation loop
   */
  async runVolumeGeneration(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const tradeInterval = (60 * 1000) / session.tradesPerMinute; // ms between trades

    while (session.status === 'running' && new Date() < session.endTime) {
      try {
        await this.executeTradeCycle(sessionId);
        await this.sleep(tradeInterval);
      } catch (error) {
        console.error(`[Volume Bot] Error in session ${sessionId}:`, error);
        session.stats.failedTrades++;
      }

      // Check if target volume reached
      if (session.stats.totalVolume >= session.targetVolume) {
        console.log(`[Volume Bot] Target volume reached for session ${sessionId}`);
        this.stopSession(sessionId);
        break;
      }
    }

    // Session ended
    if (session.status === 'running') {
      session.status = 'completed';
      console.log(`[Volume Bot] Session ${sessionId} completed`);
    }
  }

  /**
   * Execute one trade cycle (buy + sell)
   */
  async executeTradeCycle(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Pick random wallet
    const wallet = session.wallets[Math.floor(Math.random() * session.wallets.length)];

    // Random trade size
    const tradeSize = this.randomBetween(session.minTradeSize, session.maxTradeSize);

    try {
      // Execute BUY
      const buyResult = await this.executeBuy({
        tokenMint: session.tokenMint,
        solAmount: tradeSize,
        wallet,
        network: session.network,
      });

      session.trades.push(buyResult);
      session.stats.totalVolume += tradeSize;
      session.stats.tradesExecuted++;
      session.stats.successfulTrades++;

      console.log(`[Volume Bot] BUY executed: ${tradeSize} SOL - ${buyResult.signature}`);

      // Wait a bit before selling
      await this.sleep(this.randomBetween(5000, 15000));

      // Execute SELL (sell all tokens bought)
      const sellResult = await this.executeSell({
        tokenMint: session.tokenMint,
        tokenAmount: buyResult.outAmount,
        wallet,
        network: session.network,
      });

      session.trades.push(sellResult);
      session.stats.totalVolume += parseFloat(sellResult.outAmount) / 1e9; // Convert lamports to SOL
      session.stats.tradesExecuted++;
      session.stats.successfulTrades++;

      console.log(`[Volume Bot] SELL executed: ${sellResult.signature}`);

    } catch (error) {
      console.error('[Volume Bot] Trade cycle failed:', error);
      session.stats.failedTrades++;
      throw error;
    }
  }

  /**
   * Execute BUY trade
   */
  async executeBuy({ tokenMint, solAmount, wallet, network }) {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    // Get quote
    const quote = await tradingService.getQuote({
      inputMint: SOL_MINT,
      outputMint: tokenMint,
      amount: Math.floor(solAmount * 1e9), // Convert SOL to lamports
      slippageBps: 100, // 1% slippage
      network,
    });

    // Execute swap
    const result = await tradingService.executeSwap({
      quote,
      userPublicKey: wallet.publicKey,
      userKeypair: wallet,
      network,
    });

    return {
      type: 'buy',
      tokenMint,
      inAmount: solAmount,
      outAmount: quote.outAmount,
      signature: result.signature,
      solscanUrl: result.solscanUrl,
      timestamp: new Date(),
    };
  }

  /**
   * Execute SELL trade
   */
  async executeSell({ tokenMint, tokenAmount, wallet, network }) {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    // Get quote
    const quote = await tradingService.getQuote({
      inputMint: tokenMint,
      outputMint: SOL_MINT,
      amount: tokenAmount,
      slippageBps: 100, // 1% slippage
      network,
    });

    // Execute swap
    const result = await tradingService.executeSwap({
      quote,
      userPublicKey: wallet.publicKey,
      userKeypair: wallet,
      network,
    });

    return {
      type: 'sell',
      tokenMint,
      inAmount: tokenAmount,
      outAmount: quote.outAmount,
      signature: result.signature,
      solscanUrl: result.solscanUrl,
      timestamp: new Date(),
    };
  }

  /**
   * Stop volume generation session
   */
  stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'stopped';
    console.log(`[Volume Bot] Session ${sessionId} stopped`);

    return {
      sessionId,
      status: 'stopped',
      stats: session.stats,
      trades: session.trades.length,
    };
  }

  /**
   * Pause volume generation session
   */
  pauseSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'paused';
    console.log(`[Volume Bot] Session ${sessionId} paused`);

    return {
      sessionId,
      status: 'paused',
      stats: session.stats,
    };
  }

  /**
   * Resume volume generation session
   */
  resumeSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'paused') {
      throw new Error('Session is not paused');
    }

    session.status = 'running';
    console.log(`[Volume Bot] Session ${sessionId} resumed`);

    // Extend end time by the paused duration
    const now = new Date();
    const pausedDuration = now - session.pauseTime;
    session.endTime = new Date(session.endTime.getTime() + pausedDuration);

    // Restart volume generation
    this.runVolumeGeneration(sessionId);

    return {
      sessionId,
      status: 'running',
      stats: session.stats,
    };
  }

  /**
   * Get session details
   */
  getSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return {
      id: session.id,
      tokenMint: session.tokenMint,
      targetVolume: session.targetVolume,
      durationMinutes: session.durationMinutes,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      stats: session.stats,
      wallets: session.wallets.map(w => w.publicKey.toBase58()),
      tradesCount: session.trades.length,
      network: session.network,
    };
  }

  /**
   * Get all active sessions
   */
  getAllSessions() {
    const sessions = [];
    for (const [id, session] of this.activeSessions.entries()) {
      sessions.push(this.getSession(id));
    }
    return sessions;
  }

  /**
   * Get session trades
   */
  getSessionTrades(sessionId, limit = 100) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return session.trades.slice(-limit);
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const now = new Date();
    const elapsedMinutes = (now - session.startTime) / (60 * 1000);
    const volumePerMinute = session.stats.totalVolume / elapsedMinutes;

    return {
      ...session.stats,
      elapsedMinutes: Math.floor(elapsedMinutes),
      volumePerMinute: volumePerMinute.toFixed(4),
      successRate: session.stats.tradesExecuted > 0
        ? ((session.stats.successfulTrades / session.stats.tradesExecuted) * 100).toFixed(2)
        : 0,
    };
  }

  /**
   * Generate random wallets for volume generation
   */
  generateWallets(count = 5) {
    const wallets = [];
    for (let i = 0; i < count; i++) {
      wallets.push(Keypair.generate());
    }
    return wallets;
  }

  /**
   * Fund wallets with SOL for trading
   */
  async fundWallets(wallets, amountPerWallet = 1, network = 'devnet') {
    if (network !== 'devnet') {
      throw new Error('Wallet funding only available on devnet');
    }

    const results = [];
    for (const wallet of wallets) {
      try {
        const signature = await solanaConnection.requestAirdrop(
          wallet.publicKey,
          amountPerWallet,
          network
        );

        results.push({
          wallet: wallet.publicKey.toBase58(),
          amount: amountPerWallet,
          signature,
          success: true,
        });

        console.log(`[Volume Bot] Funded wallet ${wallet.publicKey.toBase58()}: ${amountPerWallet} SOL`);
      } catch (error) {
        console.error(`[Volume Bot] Failed to fund wallet:`, error);
        results.push({
          wallet: wallet.publicKey.toBase58(),
          amount: amountPerWallet,
          success: false,
          error: error.message,
        });
      }

      // Wait between airdrops to avoid rate limiting
      await this.sleep(1000);
    }

    return results;
  }

  /**
   * Helper: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Random number between min and max
   */
  randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }
}

export default new VolumeBotService();
