/**
 * Peer-to-Peer Volume Bot Service
 *
 * ULTRA-LOW-COST STRATEGY - ZERO LOSS VOLUME GENERATION
 *
 * Strategy:
 * - 50-200 wallets trade tokens DIRECTLY with each other
 * - No DEX, no swaps, no slippage = NO LOSS OF SOLANA
 * - Only pays network fees (~0.000005 SOL per transaction)
 * - Generates massive volume and transaction count
 * - Wallets send tokens back and forth continuously
 *
 * Key Features:
 * ✅ Minimum trade: 0.001 SOL worth of tokens
 * ✅ Each wallet: 0.1 SOL for fees
 * ✅ 50-200 wallets for massive parallel execution
 * ✅ Peer-to-peer token transfers (no DEX)
 * ✅ ~99.99% capital preservation (only network fees)
 * ✅ 1000+ transactions per session
 * ✅ Real on-chain volume verifiable on Solscan
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
} from '@solana/spl-token';
import bs58 from 'bs58';
import TestnetTrade from '../modules/testnet-tokens/testnet-trade.model.js';
import TestnetToken from '../modules/testnet-tokens/testnet-token.model.js';
import wsEvents from '../websocket/ws-events.js';

const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
const NETWORK_FEE_PER_TX = 0.000005; // 5000 lamports

/**
 * Parse private key from either JSON array format or base58 format
 */
function parsePrivateKey(keyInput) {
  if (!keyInput || typeof keyInput !== 'string') {
    throw new Error('Private key must be a string');
  }

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

class PeerToPeerVolumeBotService {
  constructor() {
    this.connection = new Connection(DEVNET_ENDPOINT, 'confirmed');
    this.activeSessions = new Map();
  }

  /**
   * Start peer-to-peer volume bot session
   */
  async startSession({
    tokenMint,
    fundingWalletPrivateKey,
    config = {}
  }) {
    const {
      walletCount = 100,
      solPerWallet = 0.1, // Just for fees
      tokensPerWallet = 1000, // Initial token distribution
      tradesPerMinute = 50,
      targetTransactions = 1000,
      durationMinutes = 60,
      minTradeTokens = 1, // Minimum 1 token per trade
      maxTradeTokens = 100, // Maximum 100 tokens per trade
      parallelTrades = 10, // Execute 10 trades simultaneously
    } = config;

    console.log('\n' + '='.repeat(80));
    console.log('🔄 PEER-TO-PEER VOLUME BOT - Zero Loss Strategy');
    console.log('='.repeat(80));
    console.log(`Token: ${tokenMint}`);
    console.log(`Wallets: ${walletCount} (each with ${solPerWallet} SOL for fees)`);
    console.log(`Target Transactions: ${targetTransactions}`);
    console.log(`Trade Rate: ${tradesPerMinute}/min with ${parallelTrades} parallel`);
    console.log(`Duration: ${durationMinutes} minutes`);
    console.log(`📊 Zero Slippage - Only Network Fees (~${(NETWORK_FEE_PER_TX * targetTransactions).toFixed(4)} SOL total)`);

    // Parse funding wallet
    const fundingKeypair = Keypair.fromSecretKey(parsePrivateKey(fundingWalletPrivateKey));
    console.log(`\n💰 Funding Wallet: ${fundingKeypair.publicKey.toBase58()}`);

    // Check funding wallet balance
    const fundingBalance = await this.connection.getBalance(fundingKeypair.publicKey);
    const fundingBalanceSOL = fundingBalance / LAMPORTS_PER_SOL;
    console.log(`📊 Current Balance: ${fundingBalanceSOL.toFixed(4)} SOL`);

    const totalSOLNeeded = (walletCount * solPerWallet) + 0.1; // Extra for setup
    if (fundingBalanceSOL < totalSOLNeeded) {
      throw new Error(`Insufficient SOL. Need ${totalSOLNeeded.toFixed(2)} SOL, have ${fundingBalanceSOL.toFixed(4)} SOL`);
    }

    // Create session
    const sessionId = `p2p_volume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      sessionId,
      tokenMint,
      fundingWallet: fundingKeypair.publicKey.toBase58(),
      status: 'initializing',

      capital: {
        startingSOL: walletCount * solPerWallet,
        currentSOL: walletCount * solPerWallet,
        spentOnFees: 0,
        lossPercent: 0
      },

      metrics: {
        totalTransactions: 0,
        targetTransactions,
        successfulTransactions: 0,
        failedTransactions: 0,
        totalVolumeSOL: 0, // Calculated volume in SOL terms
        totalVolumeTokens: 0,
        volumeMultiplier: 0,
        avgFeePerTx: NETWORK_FEE_PER_TX,
        startTime: null,
        endTime: null
      },

      wallets: [],

      config: {
        walletCount,
        solPerWallet,
        tokensPerWallet,
        tradesPerMinute,
        targetTransactions,
        durationMinutes,
        minTradeTokens,
        maxTradeTokens,
        parallelTrades
      },

      startTime: Date.now(),
      endTime: null
    };

    // STEP 1: Create wallets
    console.log(`\n[Step 1/3] Creating ${walletCount} Wallets...`);
    for (let i = 0; i < walletCount; i++) {
      const wallet = Keypair.generate();
      session.wallets.push({
        keypair: wallet,
        publicKey: wallet.publicKey.toBase58(),
        privateKey: bs58.encode(wallet.secretKey),
        solBalance: 0,
        tokenBalance: 0,
        transactionsSent: 0,
        transactionsReceived: 0
      });
      if (i < 3 || i >= walletCount - 3) {
        console.log(`  ✅ Wallet ${i + 1}: ${wallet.publicKey.toBase58()}`);
      } else if (i === 3) {
        console.log(`  ... (${walletCount - 6} more wallets)`);
      }
    }

    // STEP 2: Fund wallets with SOL (for fees only)
    console.log(`\n[Step 2/3] Funding Wallets (${solPerWallet} SOL each for fees)...`);
    console.log('  Using parallel batch funding...');

    const batchSize = 10;
    for (let i = 0; i < session.wallets.length; i += batchSize) {
      const batch = session.wallets.slice(i, i + batchSize);

      await Promise.all(batch.map(async (wallet, idx) => {
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
        if (i + idx < 5 || i + idx >= session.wallets.length - 5) {
          console.log(`  ✅ Funded wallet ${i + idx + 1}: ${signature.substring(0, 8)}...`);
        }
      }));
    }

    // STEP 3: Distribute tokens to all wallets
    console.log(`\n[Step 3/3] Distributing ${tokensPerWallet} tokens to each wallet...`);
    const tokenMintPubkey = new PublicKey(tokenMint);
    const mintInfo = await getMint(this.connection, tokenMintPubkey);

    const fundingTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      fundingKeypair.publicKey
    );

    for (let i = 0; i < session.wallets.length; i += batchSize) {
      const batch = session.wallets.slice(i, i + batchSize);

      await Promise.all(batch.map(async (wallet, idx) => {
        const recipientTokenAccount = await getAssociatedTokenAddress(
          tokenMintPubkey,
          wallet.keypair.publicKey
        );

        const transaction = new Transaction();

        // Create token account if needed
        try {
          await getAccount(this.connection, recipientTokenAccount);
        } catch (error) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              fundingKeypair.publicKey,
              recipientTokenAccount,
              wallet.keypair.publicKey,
              tokenMintPubkey
            )
          );
        }

        // Transfer tokens
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

        wallet.tokenBalance = tokensPerWallet;
        if (i + idx < 3) {
          console.log(`  ✅ Tokens sent to wallet ${i + idx + 1}: ${signature.substring(0, 8)}...`);
        }
      }));
    }

    // Start trading loop
    console.log('\n✅ SETUP COMPLETE - Starting Peer-to-Peer Trading...');
    session.status = 'running';
    session.metrics.startTime = Date.now();
    this.activeSessions.set(sessionId, session);

    // Emit WebSocket event
    wsEvents.emitSessionStarted({
      sessionId,
      tokenMint,
      walletCount,
      targetTransactions
    });

    // Start the P2P trading loop
    this.startTradingLoop(sessionId);

    console.log(`Session ID: ${sessionId}`);
    console.log(`Effective rate: ${tradesPerMinute * parallelTrades} transactions/minute`);
    console.log('All transactions verifiable on Solscan devnet');
    console.log('='.repeat(80) + '\n');

    return {
      success: true,
      sessionId,
      session: this.getSessionStats(sessionId)
    };
  }

  /**
   * Main trading loop - executes parallel peer-to-peer token transfers
   */
  async startTradingLoop(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const intervalMs = (60 / (session.config.tradesPerMinute * session.config.parallelTrades)) * 1000;

    const executeNextBatch = async () => {
      if (session.status !== 'running') return;

      try {
        // Execute multiple P2P transfers in parallel
        const tradePromises = [];
        for (let i = 0; i < session.config.parallelTrades; i++) {
          tradePromises.push(this.executePeerToPeerTransfer(sessionId));
        }

        await Promise.allSettled(tradePromises);

        // Check if should continue
        if (this.shouldStop(sessionId)) {
          this.stopSession(sessionId);
          return;
        }

        // Schedule next batch
        setTimeout(executeNextBatch, intervalMs);

      } catch (error) {
        console.error('[P2P Volume Bot] Batch error:', error.message);
        setTimeout(executeNextBatch, intervalMs);
      }
    };

    // Start first batch
    setTimeout(executeNextBatch, 1000);
  }

  /**
   * Execute a single peer-to-peer token transfer
   */
  async executePeerToPeerTransfer(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      // Pick two random wallets (sender and receiver)
      const senderIndex = Math.floor(Math.random() * session.wallets.length);
      let receiverIndex = Math.floor(Math.random() * session.wallets.length);

      // Ensure different wallets
      while (receiverIndex === senderIndex) {
        receiverIndex = Math.floor(Math.random() * session.wallets.length);
      }

      const sender = session.wallets[senderIndex];
      const receiver = session.wallets[receiverIndex];

      // Check sender has tokens
      if (sender.tokenBalance < session.config.minTradeTokens) {
        return; // Skip if sender doesn't have enough tokens
      }

      // Random token amount
      const tokenAmount = Math.floor(
        Math.random() * (session.config.maxTradeTokens - session.config.minTradeTokens) +
        session.config.minTradeTokens
      );

      const actualAmount = Math.min(tokenAmount, sender.tokenBalance);

      // Get token accounts
      const tokenMintPubkey = new PublicKey(session.tokenMint);
      const mintInfo = await getMint(this.connection, tokenMintPubkey);

      const senderTokenAccount = await getAssociatedTokenAddress(
        tokenMintPubkey,
        sender.keypair.publicKey
      );

      const receiverTokenAccount = await getAssociatedTokenAddress(
        tokenMintPubkey,
        receiver.keypair.publicKey
      );

      // Create transaction
      const transaction = new Transaction();

      // Ensure receiver has token account
      try {
        await getAccount(this.connection, receiverTokenAccount);
      } catch (error) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            sender.keypair.publicKey, // Sender pays for account creation
            receiverTokenAccount,
            receiver.keypair.publicKey,
            tokenMintPubkey
          )
        );
      }

      // Add transfer instruction
      const tokenLamports = actualAmount * Math.pow(10, mintInfo.decimals);
      transaction.add(
        createTransferInstruction(
          senderTokenAccount,
          receiverTokenAccount,
          sender.keypair.publicKey,
          tokenLamports,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [sender.keypair],
        { commitment: 'confirmed' }
      );

      // Update balances
      sender.tokenBalance -= actualAmount;
      receiver.tokenBalance += actualAmount;
      sender.solBalance -= NETWORK_FEE_PER_TX;
      sender.transactionsSent++;
      receiver.transactionsReceived++;

      // Get current token price for volume calculation
      const token = await TestnetToken.findOne({ mint: session.tokenMint });
      const currentPrice = token?.bondingCurve?.currentPrice || 0.00001;
      const volumeSOL = actualAmount * currentPrice;

      // Update session metrics
      session.metrics.totalTransactions++;
      session.metrics.successfulTransactions++;
      session.metrics.totalVolumeTokens += actualAmount;
      session.metrics.totalVolumeSOL += volumeSOL;
      session.capital.spentOnFees += NETWORK_FEE_PER_TX;
      session.capital.currentSOL = session.capital.startingSOL - session.capital.spentOnFees;
      session.capital.lossPercent = (session.capital.spentOnFees / session.capital.startingSOL) * 100;
      session.metrics.volumeMultiplier = session.metrics.totalVolumeSOL / session.capital.startingSOL;

      // Save trade to database
      const trade = new TestnetTrade({
        tokenMint: session.tokenMint,
        type: 'p2p_transfer',
        wallet: sender.publicKey,
        receiver: receiver.publicKey,
        tokenAmount: actualAmount,
        solAmount: volumeSOL,
        price: currentPrice,
        signature: signature,
        status: 'confirmed',
        timestamp: new Date(),
        isVolumeBot: true,
        sessionId: session.sessionId
      });

      await trade.save();

      // Log every 10th transaction
      if (session.metrics.totalTransactions % 10 === 0) {
        console.log(`  ✅ TX #${session.metrics.totalTransactions}: ${actualAmount} tokens | ...${sender.publicKey.slice(-6)} → ...${receiver.publicKey.slice(-6)}`);
        console.log(`     Volume: ${session.metrics.totalVolumeSOL.toFixed(4)} SOL (${session.metrics.volumeMultiplier.toFixed(1)}x) | Fees: ${session.capital.spentOnFees.toFixed(6)} SOL`);
      }

      // Emit WebSocket event (every 5 transactions)
      if (session.metrics.totalTransactions % 5 === 0) {
        wsEvents.emitNewTrade({
          sessionId: session.sessionId,
          tokenMint: session.tokenMint,
          type: 'p2p_transfer',
          tokenAmount: actualAmount,
          solAmount: volumeSOL,
          signature: signature,
          totalTransactions: session.metrics.totalTransactions,
          targetTransactions: session.config.targetTransactions
        });
      }

    } catch (error) {
      console.error('[P2P Volume Bot] Transfer error:', error.message);
      session.metrics.failedTransactions++;
    }
  }

  /**
   * Check if session should stop
   */
  shouldStop(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return true;

    // Stop if target transactions reached
    if (session.metrics.totalTransactions >= session.config.targetTransactions) {
      console.log(`\n🎯 STOPPING: Target transactions reached (${session.metrics.totalTransactions})`);
      return true;
    }

    // Stop if duration exceeded
    const elapsed = Date.now() - session.startTime;
    if (elapsed > session.config.durationMinutes * 60 * 1000) {
      console.log(`\n⏱️  STOPPING: Duration exceeded (${session.config.durationMinutes} minutes)`);
      return true;
    }

    // Stop if wallets running out of SOL for fees
    const walletsWithSOL = session.wallets.filter(w => w.solBalance > NETWORK_FEE_PER_TX * 10);
    if (walletsWithSOL.length < 10) {
      console.log(`\n⚠️  STOPPING: Insufficient SOL for fees (only ${walletsWithSOL.length} wallets remain)`);
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
    session.metrics.endTime = Date.now();

    const durationMin = ((session.endTime - session.startTime) / 60000).toFixed(1);
    const successRate = session.metrics.totalTransactions > 0
      ? (session.metrics.successfulTransactions / session.metrics.totalTransactions * 100).toFixed(1)
      : 0;

    console.log('\n' + '='.repeat(80));
    console.log('🏁 PEER-TO-PEER VOLUME BOT STOPPED');
    console.log('='.repeat(80));
    console.log(`Session ID: ${sessionId}`);
    console.log(`\n📊 FINAL STATS:`);
    console.log(`Total Transactions: ${session.metrics.totalTransactions} (${session.metrics.successfulTransactions} successful, ${session.metrics.failedTransactions} failed)`);
    console.log(`Success Rate: ${successRate}%`);
    console.log(`Total Volume: ${session.metrics.totalVolumeSOL.toFixed(4)} SOL (${session.metrics.totalVolumeTokens.toFixed(0)} tokens)`);
    console.log(`Volume Multiplier: ${session.metrics.volumeMultiplier.toFixed(1)}x`);
    console.log(`\n💰 CAPITAL EFFICIENCY:`);
    console.log(`Starting SOL: ${session.capital.startingSOL.toFixed(4)} SOL`);
    console.log(`Current SOL: ${session.capital.currentSOL.toFixed(4)} SOL`);
    console.log(`Spent on Fees: ${session.capital.spentOnFees.toFixed(6)} SOL`);
    console.log(`Capital Loss: ${session.capital.lossPercent.toFixed(3)}%`);
    console.log(`Average Fee/TX: ${session.metrics.avgFeePerTx.toFixed(6)} SOL`);
    console.log(`Duration: ${durationMin} minutes`);
    console.log(`\n🎯 EFFICIENCY: ${(session.metrics.totalTransactions / session.capital.spentOnFees).toFixed(0)} transactions per 1 SOL spent`);
    console.log('='.repeat(80) + '\n');

    // Emit WebSocket event
    wsEvents.emitSessionStopped({
      sessionId,
      totalTransactions: session.metrics.totalTransactions,
      totalVolumeSOL: session.metrics.totalVolumeSOL,
      volumeMultiplier: session.metrics.volumeMultiplier,
      duration: durationMin
    });
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
        walletCount: session.wallets.length,
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
        totalTransactions: session.metrics.totalTransactions,
        targetTransactions: session.config.targetTransactions,
        volumeMultiplier: session.metrics.volumeMultiplier,
        capitalLossPercent: session.capital.lossPercent
      });
    }
    return sessions;
  }
}

export default new PeerToPeerVolumeBotService();
