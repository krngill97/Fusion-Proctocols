/**
 * Enhanced Volume Bot with Liquidity Creation
 *
 * Strategy:
 * 1. Create 10 new wallets
 * 2. Fund them with SOL from main wallet
 * 3. Distribute tokens to all 10 wallets
 * 4. Wallet #1 creates liquidity pool
 * 5. All 10 wallets buy/sell continuously
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  getMint,
  createInitializeAccount3Instruction,
  getMinimumBalanceForRentExemptAccount,
} from '@solana/spl-token';
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
      if (!Array.isArray(parsed)) {
        throw new Error('JSON private key must be an array');
      }
      return Uint8Array.from(parsed);
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

class EnhancedVolumeBotService {
  constructor() {
    this.connection = new Connection(DEVNET_ENDPOINT, 'confirmed');
    this.activeSessions = new Map();
  }

  /**
   * Start enhanced volume bot session with liquidity creation
   */
  async startEnhancedSession({
    tokenMint,
    fundingWalletPrivateKey,
    config = {},
  }) {
    const sessionId = `enhanced_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('\n' + '='.repeat(60));
    console.log('🚀 ENHANCED VOLUME BOT - Starting Session');
    console.log('='.repeat(60));
    console.log(`Session ID: ${sessionId}`);
    console.log(`Token: ${tokenMint}`);

    const {
      walletCount = 10,
      solPerWallet = 0.3,
      tokensPerWallet = 10000,
      liquiditySOL = 0.5,
      liquidityTokens = 50000,
      tradesPerMinute = 5,
      durationMinutes = 60,
      minTradeAmount = 100,
      maxTradeAmount = 1000,
    } = config;

    // Parse funding wallet
    const fundingKeypair = Keypair.fromSecretKey(parsePrivateKey(fundingWalletPrivateKey));
    console.log(`\n💰 Funding Wallet: ${fundingKeypair.publicKey.toBase58()}`);

    // Check funding wallet balance
    const fundingBalance = await this.connection.getBalance(fundingKeypair.publicKey);
    const fundingBalanceSOL = fundingBalance / LAMPORTS_PER_SOL;
    console.log(`📊 Current Balance: ${fundingBalanceSOL.toFixed(4)} SOL`);

    const totalSOLNeeded = (walletCount * solPerWallet) + liquiditySOL + 0.1; // +0.1 for fees
    console.log(`💸 Total SOL Needed: ${totalSOLNeeded.toFixed(4)} SOL`);

    if (fundingBalanceSOL < totalSOLNeeded) {
      throw new Error(`Insufficient SOL. Need ${totalSOLNeeded.toFixed(4)} SOL, have ${fundingBalanceSOL.toFixed(4)} SOL`);
    }

    // STEP 1: Create wallets
    console.log(`\n[Step 1/5] Creating ${walletCount} Wallets...`);
    const wallets = [];
    for (let i = 0; i < walletCount; i++) {
      const wallet = Keypair.generate();
      wallets.push({
        keypair: wallet,
        publicKey: wallet.publicKey.toBase58(),
        privateKey: bs58.encode(wallet.secretKey),
      });
      console.log(`  ✅ Wallet ${i + 1}: ${wallet.publicKey.toBase58()}`);
    }

    // STEP 2: Fund wallets with SOL
    console.log(`\n[Step 2/5] Funding Wallets with SOL (${solPerWallet} SOL each)...`);
    const fundingSignatures = [];

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      console.log(`  💸 Funding wallet ${i + 1}/${walletCount}...`);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fundingKeypair.publicKey,
          toPubkey: wallet.keypair.publicKey,
          lamports: solPerWallet * LAMPORTS_PER_SOL,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fundingKeypair],
        { commitment: 'confirmed' }
      );

      fundingSignatures.push(signature);
      console.log(`  ✅ Funded: https://solscan.io/tx/${signature}?cluster=devnet`);
    }

    // STEP 3: Distribute tokens to all wallets
    console.log(`\n[Step 3/5] Distributing Tokens (${tokensPerWallet} tokens per wallet)...`);
    const tokenMintPubkey = new PublicKey(tokenMint);
    const mintInfo = await getMint(this.connection, tokenMintPubkey);
    const tokenDistributionSignatures = [];

    // Get funding wallet's token account
    const fundingTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      fundingKeypair.publicKey
    );

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      console.log(`  📦 Sending tokens to wallet ${i + 1}/${walletCount}...`);

      // Create associated token account for recipient
      const recipientTokenAccount = await getAssociatedTokenAddress(
        tokenMintPubkey,
        wallet.keypair.publicKey
      );

      const transaction = new Transaction();

      // Check if account exists, if not create it
      try {
        await getAccount(this.connection, recipientTokenAccount);
      } catch (error) {
        // Account doesn't exist, create it
        transaction.add(
          createAssociatedTokenAccountInstruction(
            fundingKeypair.publicKey, // payer
            recipientTokenAccount, // ata
            wallet.keypair.publicKey, // owner
            tokenMintPubkey // mint
          )
        );
      }

      // Add transfer instruction
      const tokenAmount = tokensPerWallet * Math.pow(10, mintInfo.decimals);
      transaction.add(
        createTransferInstruction(
          fundingTokenAccount,
          recipientTokenAccount,
          fundingKeypair.publicKey,
          tokenAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fundingKeypair],
        { commitment: 'confirmed' }
      );

      tokenDistributionSignatures.push(signature);
      console.log(`  ✅ Tokens sent: https://solscan.io/tx/${signature}?cluster=devnet`);
    }

    // STEP 4: Wallet #1 creates liquidity pool (simplified)
    console.log(`\n[Step 4/5] Creating Liquidity Pool...`);
    console.log(`  💧 Liquidity Provider: Wallet #1 (${wallets[0].publicKey})`);
    console.log(`  💰 Liquidity: ${liquiditySOL} SOL + ${liquidityTokens} tokens`);

    const poolInfo = {
      provider: wallets[0].publicKey,
      tokenMint: tokenMint,
      liquiditySOL: liquiditySOL,
      liquidityTokens: liquidityTokens,
      createdAt: new Date().toISOString(),
      type: 'SIMPLE_CONSTANT_PRODUCT',
      // k = liquiditySOL * liquidityTokens (constant product formula)
      k: liquiditySOL * liquidityTokens,
    };

    console.log(`  ✅ Pool Created (Tracking Mode)`);
    console.log(`  📊 K-value: ${poolInfo.k.toFixed(2)}`);
    console.log(`  📈 Initial Price: ${(liquiditySOL / liquidityTokens).toFixed(8)} SOL per token`);

    // STEP 5: Start continuous trading
    console.log(`\n[Step 5/5] Starting Continuous Trading...`);
    console.log(`  👥 Active Traders: ${walletCount} wallets`);
    console.log(`  ⚡ Trade Rate: ${tradesPerMinute} trades/minute`);
    console.log(`  ⏱️  Duration: ${durationMinutes} minutes`);

    const session = {
      id: sessionId,
      tokenMint,
      wallets: wallets.map(w => ({
        publicKey: w.publicKey,
        privateKey: w.privateKey,
        solBalance: solPerWallet,
        tokenBalance: tokensPerWallet,
      })),
      pool: poolInfo,
      config: {
        tradesPerMinute,
        durationMinutes,
        minTradeAmount,
        maxTradeAmount,
      },
      stats: {
        totalTrades: 0,
        totalVolume: 0,
        buys: 0,
        sells: 0,
      },
      fundingSignatures,
      tokenDistributionSignatures,
      startTime: new Date(),
      endTime: new Date(Date.now() + durationMinutes * 60 * 1000),
      status: 'running',
    };

    this.activeSessions.set(sessionId, session);

    // Start trading loop
    this.startTradingLoop(sessionId);

    console.log('\n' + '='.repeat(60));
    console.log('✅ ENHANCED VOLUME BOT - Session Started Successfully!');
    console.log('='.repeat(60));

    return {
      success: true,
      sessionId,
      wallets: wallets.map(w => w.publicKey),
      pool: poolInfo,
      fundingSignatures,
      tokenDistributionSignatures,
      stats: session.stats,
    };
  }

  /**
   * Execute continuous trading between wallets
   */
  async startTradingLoop(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const intervalMs = (60 * 1000) / session.config.tradesPerMinute;

    const tradingInterval = setInterval(async () => {
      // Check if session should stop
      if (new Date() >= session.endTime || session.status === 'stopped') {
        clearInterval(tradingInterval);
        session.status = 'completed';
        console.log(`\n[Enhanced Volume Bot] Session ${sessionId} completed`);
        return;
      }

      try {
        await this.executeRandomTrade(sessionId);
      } catch (error) {
        console.error(`[Enhanced Volume Bot] Trade error:`, error.message);
      }
    }, intervalMs);

    session.interval = tradingInterval;
  }

  /**
   * Execute a random trade between wallets
   */
  async executeRandomTrade(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Random: buy or sell
    const isBuy = Math.random() > 0.5;

    // Pick random wallet
    const walletIndex = Math.floor(Math.random() * session.wallets.length);
    const wallet = session.wallets[walletIndex];

    // Random trade amount
    const { minTradeAmount, maxTradeAmount } = session.config;
    const tradeAmount = Math.random() * (maxTradeAmount - minTradeAmount) + minTradeAmount;

    // Calculate price based on constant product formula
    const { pool } = session;
    const currentPrice = pool.liquiditySOL / pool.liquidityTokens;

    let tradeData;

    if (isBuy) {
      // BUY: User gives SOL, gets tokens
      const solAmount = tradeAmount * currentPrice;
      const tokensReceived = tradeAmount;

      // Update pool reserves (constant product: x * y = k)
      pool.liquiditySOL += solAmount;
      pool.liquidityTokens -= tokensReceived;

      // Update wallet balances
      wallet.solBalance -= solAmount;
      wallet.tokenBalance += tokensReceived;

      session.stats.totalTrades++;
      session.stats.buys++;
      session.stats.totalVolume += solAmount;

      tradeData = {
        type: 'buy',
        tokenAmount: tokensReceived,
        solAmount: solAmount,
        price: currentPrice,
      };

      console.log(`\n[Trade ${session.stats.totalTrades}] 🟢 BUY`);
      console.log(`  Wallet: ${wallet.publicKey.substring(0, 8)}...`);
      console.log(`  Amount: ${tokensReceived.toFixed(2)} tokens for ${solAmount.toFixed(6)} SOL`);
      console.log(`  Price: ${currentPrice.toFixed(8)} SOL/token`);
      console.log(`  New Pool: ${pool.liquiditySOL.toFixed(4)} SOL, ${pool.liquidityTokens.toFixed(2)} tokens`);
    } else {
      // SELL: User gives tokens, gets SOL
      const tokensAmount = tradeAmount;
      const solReceived = tokensAmount * currentPrice;

      // Update pool reserves
      pool.liquiditySOL -= solReceived;
      pool.liquidityTokens += tokensAmount;

      // Update wallet balances
      wallet.solBalance += solReceived;
      wallet.tokenBalance -= tokensAmount;

      session.stats.totalTrades++;
      session.stats.sells++;
      session.stats.totalVolume += solReceived;

      tradeData = {
        type: 'sell',
        tokenAmount: tokensAmount,
        solAmount: solReceived,
        price: currentPrice,
      };

      console.log(`\n[Trade ${session.stats.totalTrades}] 🔴 SELL`);
      console.log(`  Wallet: ${wallet.publicKey.substring(0, 8)}...`);
      console.log(`  Amount: ${tokensAmount.toFixed(2)} tokens for ${solReceived.toFixed(6)} SOL`);
      console.log(`  Price: ${currentPrice.toFixed(8)} SOL/token`);
      console.log(`  New Pool: ${pool.liquiditySOL.toFixed(4)} SOL, ${pool.liquidityTokens.toFixed(2)} tokens`);
    }

    // Update price
    const newPrice = pool.liquiditySOL / pool.liquidityTokens;
    const priceChange = ((newPrice - currentPrice) / currentPrice) * 100;
    console.log(`  Price Change: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`);

    // Save trade to database
    try {
      const trade = new TestnetTrade({
        tokenMint: session.tokenMint,
        type: tradeData.type,
        wallet: wallet.publicKey,
        tokenAmount: tradeData.tokenAmount,
        solAmount: tradeData.solAmount,
        price: tradeData.price,
        signature: `simulated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'confirmed',
        timestamp: new Date(),
      });

      await trade.save();

      // Update token stats
      await TestnetToken.findOneAndUpdate(
        { mint: session.tokenMint },
        {
          $set: {
            price: newPrice,
            volume24h: session.stats.totalVolume,
            trades24h: session.stats.totalTrades,
            liquidity: pool.liquiditySOL,
          },
        }
      );
    } catch (error) {
      console.error('[Enhanced Volume Bot] Error saving trade:', error.message);
    }
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    const sessions = [];

    for (const [sessionId, session] of this.activeSessions.entries()) {
      sessions.push({
        id: session.id,
        tokenMint: session.tokenMint,
        status: session.status,
        totalVolume: session.stats.totalVolume,
        totalTrades: session.stats.totalTrades,
        startTime: session.startTime,
      });
    }

    return {
      success: true,
      sessions,
    };
  }

  /**
   * Get session status
   */
  getSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { success: false, message: 'Session not found' };
    }

    return {
      success: true,
      session: {
        id: session.id,
        tokenMint: session.tokenMint,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        wallets: session.wallets.map(w => w.publicKey),
        pool: session.pool,
        stats: session.stats,
        config: session.config,
      },
    };
  }

  /**
   * Stop a session
   */
  stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { success: false, message: 'Session not found' };
    }

    if (session.interval) {
      clearInterval(session.interval);
    }

    session.status = 'stopped';

    return {
      success: true,
      message: 'Session stopped',
      stats: session.stats,
    };
  }
}

export default new EnhancedVolumeBotService();
