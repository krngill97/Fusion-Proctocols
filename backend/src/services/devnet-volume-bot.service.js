/**
 * Devnet Volume Bot Service
 * Generates real on-chain volume for devnet SPL tokens
 * Uses direct token transfers (no liquidity pools required)
 * All transactions visible on Solscan.io/devnet
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
} from '@solana/spl-token';

const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';

class DevnetVolumeBotService {
  constructor() {
    this.connection = new Connection(DEVNET_ENDPOINT, 'confirmed');
    this.activeSessions = new Map();
  }

  /**
   * Start a devnet volume generation session
   */
  async startSession({
    tokenMint,
    fundingWalletPrivateKey, // The wallet that owns the tokens
    config = {},
  }) {
    const sessionId = `devnet_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[Devnet Volume Bot] Starting session: ${sessionId}`);
    console.log(`[Devnet Volume Bot] Token: ${tokenMint}`);

    const {
      walletCount = 5,
      tradesPerMinute = 2,
      durationMinutes = 30,
      minTransferAmount = 10,
      maxTransferAmount = 100,
    } = config;

    // Create funding wallet from private key
    const fundingKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fundingWalletPrivateKey))
    );

    // Generate maker wallets
    const makerWallets = [];
    for (let i = 0; i < walletCount; i++) {
      makerWallets.push(Keypair.generate());
    }

    const session = {
      id: sessionId,
      tokenMint,
      fundingWallet: fundingKeypair.publicKey.toBase58(),
      makerWallets: makerWallets.map(w => ({
        publicKey: w.publicKey.toBase58(),
        keypair: w,
      })),
      config: {
        walletCount,
        tradesPerMinute,
        durationMinutes,
        minTransferAmount,
        maxTransferAmount,
      },
      startTime: new Date(),
      endTime: new Date(Date.now() + durationMinutes * 60 * 1000),
      status: 'initializing',
      stats: {
        totalTransfers: 0,
        totalVolume: 0,
        successfulTransfers: 0,
        failedTransfers: 0,
      },
      transactions: [],
    };

    this.activeSessions.set(sessionId, session);

    // Initialize wallets in background
    this.initializeSession(sessionId, fundingKeypair, new PublicKey(tokenMint)).catch(err => {
      console.error('[Devnet Volume Bot] Initialization error:', err);
      session.status = 'failed';
    });

    return {
      sessionId,
      status: session.status,
      wallets: makerWallets.map(w => w.publicKey.toBase58()),
      startTime: session.startTime,
      endTime: session.endTime,
    };
  }

  /**
   * Initialize session: airdrop SOL and distribute tokens
   */
  async initializeSession(sessionId, fundingKeypair, tokenMint) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      console.log(`[Devnet Volume Bot] Initializing wallets for session ${sessionId}...`);

      // Step 1: Airdrop SOL to maker wallets
      for (let i = 0; i < session.makerWallets.length; i++) {
        const wallet = session.makerWallets[i];
        try {
          console.log(`[Devnet Volume Bot] Airdropping SOL to wallet ${i + 1}/${session.makerWallets.length}...`);
          const airdropSignature = await this.connection.requestAirdrop(
            wallet.keypair.publicKey,
            0.1 * LAMPORTS_PER_SOL
          );
          await this.connection.confirmTransaction(airdropSignature);
          await this.sleep(1000); // Rate limit
        } catch (error) {
          console.error(`[Devnet Volume Bot] Airdrop failed for wallet ${i}:`, error.message);
        }
      }

      // Step 2: Create token accounts and distribute tokens
      const fundingTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        fundingKeypair.publicKey
      );

      for (let i = 0; i < session.makerWallets.length; i++) {
        const wallet = session.makerWallets[i];
        try {
          const makerTokenAccount = await getAssociatedTokenAddress(
            tokenMint,
            wallet.keypair.publicKey
          );

          // Check if token account exists
          let accountExists = false;
          try {
            await getAccount(this.connection, makerTokenAccount);
            accountExists = true;
          } catch (err) {
            // Account doesn't exist
          }

          const transaction = new Transaction();

          // Create token account if needed
          if (!accountExists) {
            transaction.add(
              createAssociatedTokenAccountInstruction(
                fundingKeypair.publicKey,
                makerTokenAccount,
                wallet.keypair.publicKey,
                tokenMint
              )
            );
          }

          // Transfer initial tokens
          const initialAmount = this.randomBetween(
            session.config.minTransferAmount * 10,
            session.config.maxTransferAmount * 10
          );

          transaction.add(
            createTransferInstruction(
              fundingTokenAccount,
              makerTokenAccount,
              fundingKeypair.publicKey,
              BigInt(Math.floor(initialAmount))
            )
          );

          const signature = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [fundingKeypair]
          );

          console.log(`[Devnet Volume Bot] Initialized wallet ${i + 1}: ${signature}`);
          await this.sleep(500);

        } catch (error) {
          console.error(`[Devnet Volume Bot] Token distribution failed for wallet ${i}:`, error.message);
        }
      }

      // Step 3: Start volume generation
      session.status = 'running';
      console.log(`[Devnet Volume Bot] Session ${sessionId} initialized and running`);
      this.runVolumeGeneration(sessionId, tokenMint);

    } catch (error) {
      console.error(`[Devnet Volume Bot] Initialization error:`, error);
      session.status = 'failed';
    }
  }

  /**
   * Run volume generation loop
   */
  async runVolumeGeneration(sessionId, tokenMint) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const tradeInterval = (60 * 1000) / session.config.tradesPerMinute;

    while (session.status === 'running' && new Date() < session.endTime) {
      try {
        await this.executeTransfer(sessionId, tokenMint);
        await this.sleep(tradeInterval);
      } catch (error) {
        console.error(`[Devnet Volume Bot] Transfer error:`, error);
        session.stats.failedTransfers++;
      }
    }

    session.status = 'completed';
    console.log(`[Devnet Volume Bot] Session ${sessionId} completed`);
  }

  /**
   * Execute a token transfer between wallets
   */
  async executeTransfer(sessionId, tokenMint) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Pick two random different wallets
    const walletCount = session.makerWallets.length;
    const fromIndex = Math.floor(Math.random() * walletCount);
    let toIndex = Math.floor(Math.random() * walletCount);
    while (toIndex === fromIndex) {
      toIndex = Math.floor(Math.random() * walletCount);
    }

    const fromWallet = session.makerWallets[fromIndex];
    const toWallet = session.makerWallets[toIndex];

    try {
      const fromTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        fromWallet.keypair.publicKey
      );

      const toTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        toWallet.keypair.publicKey
      );

      // Check balance
      const fromAccount = await getAccount(this.connection, fromTokenAccount);
      const balance = Number(fromAccount.amount);

      if (balance < session.config.minTransferAmount) {
        console.log(`[Devnet Volume Bot] Wallet ${fromIndex} has insufficient balance, skipping`);
        return;
      }

      // Random transfer amount
      const maxTransfer = Math.min(
        session.config.maxTransferAmount,
        balance * 0.5 // Only transfer up to 50% of balance
      );
      const amount = this.randomBetween(
        session.config.minTransferAmount,
        maxTransfer
      );

      // Create transfer transaction
      const transaction = new Transaction().add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromWallet.keypair.publicKey,
          BigInt(Math.floor(amount))
        )
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromWallet.keypair],
        { commitment: 'confirmed' }
      );

      const solscanUrl = `https://solscan.io/tx/${signature}?cluster=devnet`;

      session.stats.totalTransfers++;
      session.stats.successfulTransfers++;
      session.stats.totalVolume += amount;

      session.transactions.push({
        signature,
        from: fromWallet.publicKey,
        to: toWallet.publicKey,
        amount,
        timestamp: new Date(),
        solscanUrl,
      });

      console.log(`[Devnet Volume Bot] Transfer ${session.stats.totalTransfers}: ${amount} tokens`);
      console.log(`[Devnet Volume Bot] Solscan: ${solscanUrl}`);

    } catch (error) {
      console.error(`[Devnet Volume Bot] Transfer failed:`, error.message);
      session.stats.failedTransfers++;
    }
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
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      config: session.config,
      stats: session.stats,
      wallets: session.makerWallets.map(w => w.publicKey),
      recentTransactions: session.transactions.slice(-10),
    };
  }

  /**
   * Stop a session
   */
  stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'stopped';
    console.log(`[Devnet Volume Bot] Session ${sessionId} stopped`);

    return this.getSession(sessionId);
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

export default new DevnetVolumeBotService();
