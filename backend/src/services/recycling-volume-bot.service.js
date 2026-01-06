/**
 * Recycling Volume Bot Service
 * Generates maximum volume with limited capital by recycling buy/sell cycles
 *
 * Strategy:
 * - Buy tokens with SOL → Sell tokens for SOL → Repeat
 * - Same capital generates 10-20x volume through cycling
 * - Controls losses to stay under configured threshold
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import TestnetTrade from '../modules/testnet-tokens/testnet-trade.model.js';
import TestnetToken from '../modules/testnet-tokens/testnet-token.model.js';

const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';

/**
 * Parse private key from either JSON array format or base58 format
 */
function parsePrivateKey(keyInput) {
  if (!keyInput || typeof keyInput !== 'string') {
    throw new Error('Private key must be a string');
  }

  // Try parsing as JSON array first
  if (keyInput.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(keyInput);
      if (!Array.isArray(parsed) || parsed.length !== 64) {
        throw new Error(`Invalid array length: expected 64 bytes, got ${parsed.length}`);
      }
      return new Uint8Array(parsed);
    } catch (error) {
      throw new Error(`Invalid JSON array format for private key: ${error.message}`);
    }
  }

  // Try parsing as base58 string
  try {
    const decoded = bs58.decode(keyInput);
    if (decoded.length !== 64) {
      throw new Error(`Invalid private key length: expected 64 bytes, got ${decoded.length}`);
    }
    return decoded;
  } catch (error) {
    throw new Error(`Invalid base58 format for private key: ${error.message}`);
  }
}

class RecyclingVolumeBotService {
  constructor() {
    this.connection = new Connection(DEVNET_ENDPOINT, 'confirmed');
    this.activeSessions = new Map(); // sessionId -> session data
  }

  /**
   * Start a recycling volume bot session
   */
  async startSession({
    tokenMint,
    fundingWalletPrivateKey,
    config = {}
  }) {
    const {
      startingCapital = 1.0,
      walletCount = 20,
      tradesPerMinute = 20,
      targetVolume = 20,
      maxLossPercent = 20,
      durationMinutes = 60,
      buyRatio = 0.6,
      minTradeSize = 0.01,
      maxTradeSize = 0.05
    } = config;

    console.log('\n🔄 STARTING RECYCLING VOLUME BOT');
    console.log('================================');
    console.log(`Token: ${tokenMint}`);
    console.log(`Starting Capital: ${startingCapital} SOL`);
    console.log(`Wallet Count: ${walletCount}`);
    console.log(`Target Volume: ${targetVolume} SOL (${targetVolume / startingCapital}x multiplier)`);
    console.log(`Max Loss: ${maxLossPercent}%`);
    console.log(`Duration: ${durationMinutes} minutes`);

    // Parse funding wallet
    const fundingKeypair = Keypair.fromSecretKey(parsePrivateKey(fundingWalletPrivateKey));
    console.log(`\n💰 Funding Wallet: ${fundingKeypair.publicKey.toBase58()}`);

    // Check funding wallet balance
    const fundingBalance = await this.connection.getBalance(fundingKeypair.publicKey);
    const fundingBalanceSOL = fundingBalance / LAMPORTS_PER_SOL;
    console.log(`Balance: ${fundingBalanceSOL.toFixed(4)} SOL`);

    const totalNeeded = startingCapital + 0.1; // Extra for fees
    if (fundingBalanceSOL < totalNeeded) {
      throw new Error(`Insufficient SOL. Need ${totalNeeded.toFixed(2)} SOL, have ${fundingBalanceSOL.toFixed(4)} SOL`);
    }

    // Create session
    const sessionId = `recycling_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      sessionId,
      tokenMint,
      fundingWallet: fundingKeypair.publicKey.toBase58(),
      status: 'initializing',

      capital: {
        starting: startingCapital,
        current: startingCapital,
        lossPercent: 0
      },

      metrics: {
        totalVolume: 0,
        volumeMultiplier: 0,
        totalTrades: 0,
        buyTrades: 0,
        sellTrades: 0,
        cycles: 0,
        avgSlippage: 0,
        totalFees: 0,
        startPrice: 0,
        currentPrice: 0
      },

      wallets: [],

      config: {
        walletCount,
        tradesPerMinute,
        targetVolume,
        maxLossPercent,
        durationMinutes,
        buyRatio,
        minTradeSize,
        maxTradeSize
      },

      startTime: Date.now(),
      endTime: null
    };

    // STEP 1: Create wallets
    console.log(`\n[Step 1/3] Creating ${walletCount} Wallets...`);
    const solPerWallet = startingCapital / walletCount;

    for (let i = 0; i < walletCount; i++) {
      const wallet = Keypair.generate();
      session.wallets.push({
        keypair: wallet,
        publicKey: wallet.publicKey.toBase58(),
        privateKey: bs58.encode(wallet.secretKey),
        solBalance: 0,
        tokenBalance: 0,
        totalBuys: 0,
        totalSells: 0
      });
      console.log(`  ✅ Wallet ${i + 1}: ${wallet.publicKey.toBase58()}`);
    }

    // STEP 2: Fund wallets with SOL
    console.log(`\n[Step 2/3] Funding Wallets (${solPerWallet.toFixed(4)} SOL each)...`);
    for (let i = 0; i < session.wallets.length; i++) {
      const wallet = session.wallets[i];

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fundingKeypair.publicKey,
          toPubkey: wallet.keypair.publicKey,
          lamports: Math.floor(solPerWallet * LAMPORTS_PER_SOL),
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fundingKeypair],
        { commitment: 'confirmed' }
      );

      wallet.solBalance = solPerWallet;
      console.log(`  ✅ Funded wallet ${i + 1}: ${signature.substring(0, 8)}...`);
    }

    // STEP 3: Start trading loop
    console.log('\n[Step 3/3] Starting Trading Loop...');
    session.status = 'running';
    this.activeSessions.set(sessionId, session);

    // Start the recycling trade loop
    this.startTradingLoop(sessionId);

    console.log('\n✅ RECYCLING VOLUME BOT STARTED!');
    console.log(`Session ID: ${sessionId}`);
    console.log(`Trades will execute every ${(60 / tradesPerMinute).toFixed(1)} seconds`);

    return {
      success: true,
      sessionId,
      session: this.getSessionStats(sessionId)
    };
  }

  /**
   * Main trading loop - executes buy/sell cycles
   */
  async startTradingLoop(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const intervalMs = (60 / session.config.tradesPerMinute) * 1000;

    const executeNextTrade = async () => {
      if (session.status !== 'running') return;

      try {
        await this.executeRecyclingTrade(sessionId);

        // Check if should continue
        if (this.shouldStop(sessionId)) {
          this.stopSession(sessionId);
          return;
        }

        // Schedule next trade
        setTimeout(executeNextTrade, intervalMs);

      } catch (error) {
        console.error('[Recycling Bot] Trade error:', error.message);
        setTimeout(executeNextTrade, intervalMs);
      }
    };

    // Start first trade
    setTimeout(executeNextTrade, 1000);
  }

  /**
   * Execute a single recycling trade (buy or sell)
   */
  async executeRecyclingTrade(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Decide: buy or sell?
    const shouldBuy = this.decideBuyOrSell(session);

    if (shouldBuy) {
      await this.executeBuyTrade(session);
    } else {
      await this.executeSellTrade(session);
    }
  }

  /**
   * Decide whether to buy or sell
   */
  decideBuyOrSell(session) {
    const walletsWithTokens = session.wallets.filter(w => w.tokenBalance > 0);
    const walletsWithSOL = session.wallets.filter(w => w.solBalance >= session.config.minTradeSize);

    // Must sell if no wallets have SOL
    if (walletsWithSOL.length === 0 && walletsWithTokens.length > 0) return false;

    // Must buy if no wallets have tokens
    if (walletsWithTokens.length === 0 && walletsWithSOL.length > 0) return true;

    // Random based on buy ratio (default 60% buy, 40% sell)
    return Math.random() < session.config.buyRatio;
  }

  /**
   * Execute a BUY trade
   */
  async executeBuyTrade(session) {
    // Pick wallet with SOL
    const walletsWithSOL = session.wallets.filter(w => w.solBalance >= session.config.minTradeSize);
    if (walletsWithSOL.length === 0) return;

    const wallet = walletsWithSOL[Math.floor(Math.random() * walletsWithSOL.length)];

    // Calculate trade size
    const maxPossible = Math.min(wallet.solBalance, session.config.maxTradeSize);
    const solAmount = Math.random() * (maxPossible - session.config.minTradeSize) + session.config.minTradeSize;

    // Get token from database to get current price
    const token = await TestnetToken.findOne({ mint: session.tokenMint });
    if (!token) {
      console.error('[Recycling Bot] Token not found');
      return;
    }

    const currentPrice = token.bondingCurve.currentPrice;
    const tokenAmount = solAmount / currentPrice;
    const newPrice = currentPrice * 1.01; // Small price increase

    // Update wallet balances
    wallet.solBalance -= solAmount;
    wallet.tokenBalance += tokenAmount;
    wallet.totalBuys++;

    // Update session metrics
    session.metrics.totalVolume += solAmount;
    session.metrics.totalTrades++;
    session.metrics.buyTrades++;
    session.metrics.currentPrice = newPrice;
    if (session.metrics.startPrice === 0) session.metrics.startPrice = currentPrice;
    session.metrics.volumeMultiplier = session.metrics.totalVolume / session.capital.starting;

    // Update capital
    session.capital.current = session.wallets.reduce((sum, w) => sum + w.solBalance, 0);
    session.capital.lossPercent = ((session.capital.starting - session.capital.current) / session.capital.starting) * 100;

    // Save trade to database
    try {
      const trade = new TestnetTrade({
        tokenMint: session.tokenMint,
        type: 'buy',
        wallet: wallet.publicKey,
        tokenAmount,
        solAmount,
        price: currentPrice,
        signature: `recycling_buy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'confirmed',
        timestamp: new Date(),
        isVolumeBot: true
      });

      await trade.save();

      // Update token price
      await TestnetToken.findOneAndUpdate(
        { mint: session.tokenMint },
        {
          $set: {
            'bondingCurve.currentPrice': newPrice,
            volume24h: session.metrics.totalVolume,
            trades24h: session.metrics.totalTrades
          }
        }
      );

      console.log(`  🟢 BUY: ${tokenAmount.toFixed(2)} tokens for ${solAmount.toFixed(4)} SOL | Volume: ${session.metrics.totalVolume.toFixed(2)} SOL (${session.metrics.volumeMultiplier.toFixed(1)}x)`);

    } catch (error) {
      console.error('[Recycling Bot] Error saving buy trade:', error.message);
    }
  }

  /**
   * Execute a SELL trade
   */
  async executeSellTrade(session) {
    // Pick wallet with tokens
    const walletsWithTokens = session.wallets.filter(w => w.tokenBalance > 0);
    if (walletsWithTokens.length === 0) return;

    const wallet = walletsWithTokens[Math.floor(Math.random() * walletsWithTokens.length)];

    // Calculate tokens to sell (20-80% of balance)
    const sellPercent = Math.random() * 0.6 + 0.2; // 20-80%
    const tokenAmount = wallet.tokenBalance * sellPercent;

    // Get token from database
    const token = await TestnetToken.findOne({ mint: session.tokenMint });
    if (!token) {
      console.error('[Recycling Bot] Token not found');
      return;
    }

    const currentPrice = token.bondingCurve.currentPrice;
    const solAmount = tokenAmount * currentPrice * 0.95; // 5% slippage on sell
    const newPrice = currentPrice * 0.99; // Small price decrease

    // Update wallet balances
    wallet.tokenBalance -= tokenAmount;
    wallet.solBalance += solAmount;
    wallet.totalSells++;

    // Update session metrics
    session.metrics.totalVolume += solAmount;
    session.metrics.totalTrades++;
    session.metrics.sellTrades++;
    session.metrics.currentPrice = newPrice;
    session.metrics.volumeMultiplier = session.metrics.totalVolume / session.capital.starting;

    // Check if completed a cycle (both buy and sell)
    if (wallet.totalBuys > 0 && wallet.totalSells > 0) {
      session.metrics.cycles = Math.min(wallet.totalBuys, wallet.totalSells);
    }

    // Update capital
    session.capital.current = session.wallets.reduce((sum, w) => sum + w.solBalance, 0);
    session.capital.lossPercent = ((session.capital.starting - session.capital.current) / session.capital.starting) * 100;

    // Save trade to database
    try {
      const trade = new TestnetTrade({
        tokenMint: session.tokenMint,
        type: 'sell',
        wallet: wallet.publicKey,
        tokenAmount,
        solAmount,
        price: currentPrice,
        signature: `recycling_sell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'confirmed',
        timestamp: new Date(),
        isVolumeBot: true
      });

      await trade.save();

      // Update token price
      await TestnetToken.findOneAndUpdate(
        { mint: session.tokenMint },
        {
          $set: {
            'bondingCurve.currentPrice': newPrice,
            volume24h: session.metrics.totalVolume,
            trades24h: session.metrics.totalTrades
          }
        }
      );

      console.log(`  🔴 SELL: ${tokenAmount.toFixed(2)} tokens for ${solAmount.toFixed(4)} SOL | Volume: ${session.metrics.totalVolume.toFixed(2)} SOL (${session.metrics.volumeMultiplier.toFixed(1)}x)`);

    } catch (error) {
      console.error('[Recycling Bot] Error saving sell trade:', error.message);
    }
  }

  /**
   * Check if session should stop
   */
  shouldStop(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return true;

    // Stop if loss exceeds threshold
    if (session.capital.lossPercent >= session.config.maxLossPercent) {
      console.log(`\n⚠️  STOPPING: Loss threshold reached (${session.capital.lossPercent.toFixed(1)}%)`);
      return true;
    }

    // Stop if target volume reached
    if (session.metrics.totalVolume >= session.config.targetVolume) {
      console.log(`\n🎯 STOPPING: Target volume reached (${session.metrics.totalVolume.toFixed(2)} SOL)`);
      return true;
    }

    // Stop if duration exceeded
    const elapsed = Date.now() - session.startTime;
    if (elapsed > session.config.durationMinutes * 60 * 1000) {
      console.log(`\n⏱️  STOPPING: Duration exceeded (${session.config.durationMinutes} minutes)`);
      return true;
    }

    // Stop if almost all capital lost
    if (session.capital.current < 0.05) {
      console.log(`\n❌ STOPPING: Insufficient capital remaining (${session.capital.current.toFixed(4)} SOL)`);
      return true;
    }

    return false;
  }

  /**
   * Stop a session
   */
  stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.status = 'stopped';
    session.endTime = Date.now();

    console.log('\n🏁 RECYCLING VOLUME BOT STOPPED');
    console.log('================================');
    console.log(`Session ID: ${sessionId}`);
    console.log(`\n📊 FINAL STATS:`);
    console.log(`Total Volume: ${session.metrics.totalVolume.toFixed(2)} SOL`);
    console.log(`Volume Multiplier: ${session.metrics.volumeMultiplier.toFixed(1)}x`);
    console.log(`Total Trades: ${session.metrics.totalTrades}`);
    console.log(`Buys: ${session.metrics.buyTrades} | Sells: ${session.metrics.sellTrades}`);
    console.log(`Cycles: ${session.metrics.cycles}`);
    console.log(`\n💰 CAPITAL:`);
    console.log(`Starting: ${session.capital.starting.toFixed(4)} SOL`);
    console.log(`Final: ${session.capital.current.toFixed(4)} SOL`);
    console.log(`Loss: ${session.capital.lossPercent.toFixed(2)}%`);
    console.log(`Duration: ${((session.endTime - session.startTime) / 60000).toFixed(1)} minutes`);
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { success: false, message: 'Session not found' };
    }

    const elapsed = Date.now() - session.startTime;
    const remaining = Math.max(0, (session.config.durationMinutes * 60 * 1000) - elapsed);

    return {
      success: true,
      session: {
        sessionId: session.sessionId,
        tokenMint: session.tokenMint,
        status: session.status,
        capital: session.capital,
        metrics: session.metrics,
        config: session.config,
        wallets: session.wallets.map(w => ({
          publicKey: w.publicKey,
          solBalance: w.solBalance,
          tokenBalance: w.tokenBalance,
          totalBuys: w.totalBuys,
          totalSells: w.totalSells
        })),
        elapsed: Math.floor(elapsed / 1000),
        remaining: Math.floor(remaining / 1000)
      }
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    const sessions = [];
    for (const [sessionId, session] of this.activeSessions) {
      sessions.push({
        sessionId,
        tokenMint: session.tokenMint,
        status: session.status,
        volumeMultiplier: session.metrics.volumeMultiplier,
        totalVolume: session.metrics.totalVolume,
        totalTrades: session.metrics.totalTrades
      });
    }
    return sessions;
  }
}

export default new RecyclingVolumeBotService();
