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
import bs58 from 'bs58';
import * as jupiterService from '../modules/trading-engine/jupiter.service.js';
import TestnetTrade from '../modules/testnet-tokens/testnet-trade.model.js';
import TestnetToken from '../modules/testnet-tokens/testnet-token.model.js';
import wsEvents from '../websocket/ws-events.js';

const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Parse private key from either JSON array format or base58 format
 * @param {string} keyInput - Private key as JSON array "[123,45,67,...]" or base58 string
 * @returns {Uint8Array} - Private key as Uint8Array
 */
function parsePrivateKey(keyInput) {
  if (!keyInput || typeof keyInput !== 'string') {
    throw new Error('Private key must be a string');
  }

  // Try parsing as JSON array first (e.g., "[123,45,67,...]")
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

    // Create funding wallet from private key (supports both JSON array and base58 formats)
    const fundingKeypair = Keypair.fromSecretKey(
      parsePrivateKey(fundingWalletPrivateKey)
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

    // Check if token has liquidity pool (only check once at start)
    let hasLiquidityPool = false;
    let useSwaps = session.config.useSwaps !== false; // Default to true if not specified

    try {
      const token = await TestnetToken.findOne({ mint: tokenMint.toBase58() });
      if (token && token.lifecycle?.poolAddress) {
        hasLiquidityPool = true;
        console.log(`[Devnet Volume Bot] Token has liquidity pool, will use real swaps`);
      } else {
        console.log(`[Devnet Volume Bot] Token has no liquidity pool, will use transfers`);
        useSwaps = false; // Force transfers if no pool
      }
    } catch (error) {
      console.error(`[Devnet Volume Bot] Error checking token liquidity:`, error);
      useSwaps = false; // Fallback to transfers on error
    }

    while (session.status === 'running' && new Date() < session.endTime) {
      try {
        if (useSwaps && hasLiquidityPool) {
          // Execute real Jupiter swaps for tokens with liquidity
          await this.executeSwap(sessionId, tokenMint);
        } else {
          // Execute simple transfers for tokens without liquidity
          await this.executeTransfer(sessionId, tokenMint);
        }
        await this.sleep(tradeInterval);
      } catch (error) {
        console.error(`[Devnet Volume Bot] Trade error:`, error);
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
   * Execute a swap (buy or sell) using Jupiter
   * @param {string} sessionId - Session ID
   * @param {PublicKey} tokenMint - Token mint address
   */
  async executeSwap(sessionId, tokenMint) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Randomly choose buy or sell based on buyProbability config
    const buyProbability = session.config.buyProbability || 0.5;
    const isBuy = Math.random() < buyProbability;

    // Pick a random wallet
    const walletIndex = Math.floor(Math.random() * session.makerWallets.length);
    const wallet = session.makerWallets[walletIndex];

    try {
      let result;
      let tradeType;
      let solAmount;
      let tokenAmount;

      if (isBuy) {
        // BUY: SOL → Token
        solAmount = this.randomBetween(
          session.config.minSolAmount || 0.01,
          session.config.maxSolAmount || 0.1
        );

        console.log(`[Devnet Volume Bot] Attempting BUY: ${solAmount} SOL for tokens`);

        // Get quote
        const quote = await jupiterService.getQuote({
          inputMint: SOL_MINT,
          outputMint: tokenMint.toBase58(),
          amount: Math.floor(solAmount * LAMPORTS_PER_SOL),
          slippageBps: 500 // 5% slippage for volume bot
        });

        if (!quote || !quote.routePlan) {
          console.log(`[Devnet Volume Bot] No route found for BUY, skipping`);
          return;
        }

        // Execute swap
        result = await jupiterService.executeSwap({
          wallet: wallet.keypair,
          route: quote,
          slippageBps: 500
        });

        tokenAmount = result.outputAmount / Math.pow(10, 9); // Assuming 9 decimals
        tradeType = 'buy';

      } else {
        // SELL: Token → SOL
        // Check token balance
        const tokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          wallet.keypair.publicKey
        );

        try {
          const account = await getAccount(this.connection, tokenAccount);
          const balance = Number(account.amount);

          if (balance < (session.config.minTokenAmount || 10)) {
            console.log(`[Devnet Volume Bot] Insufficient token balance for SELL, skipping`);
            return;
          }

          tokenAmount = this.randomBetween(
            session.config.minTokenAmount || 10,
            Math.min(session.config.maxTokenAmount || 1000, balance * 0.5)
          );

          console.log(`[Devnet Volume Bot] Attempting SELL: ${tokenAmount} tokens for SOL`);

          // Get quote
          const quote = await jupiterService.getQuote({
            inputMint: tokenMint.toBase58(),
            outputMint: SOL_MINT,
            amount: Math.floor(tokenAmount),
            slippageBps: 500
          });

          if (!quote || !quote.routePlan) {
            console.log(`[Devnet Volume Bot] No route found for SELL, skipping`);
            return;
          }

          // Execute swap
          result = await jupiterService.executeSwap({
            wallet: wallet.keypair,
            route: quote,
            slippageBps: 500
          });

          solAmount = result.outputAmount / LAMPORTS_PER_SOL;
          tradeType = 'sell';

        } catch (error) {
          console.log(`[Devnet Volume Bot] Token account not found or error:`, error.message);
          return;
        }
      }

      // Record the trade
      const signature = result.txid;
      const solscanUrl = `https://solscan.io/tx/${signature}?cluster=devnet`;
      const price = isBuy ? (solAmount / tokenAmount) : (solAmount / tokenAmount);

      // Save to TestnetTrade model
      await TestnetTrade.create({
        signature,
        tokenMint: tokenMint.toBase58(),
        wallet: wallet.keypair.publicKey.toBase58(),
        type: tradeType,
        solAmount,
        tokenAmount,
        price,
        priceImpact: result.priceImpact || 0,
        slippagePercent: 5,
        isVolumeBot: true,
        volumeSessionId: sessionId,
        status: 'confirmed',
        timestamp: new Date(),
        network: 'devnet'
      });

      // Update session stats
      session.stats.totalTransfers++;
      session.stats.successfulTransfers++;
      session.stats.totalVolume += solAmount;

      if (tradeType === 'buy') {
        session.stats.buyCount = (session.stats.buyCount || 0) + 1;
      } else {
        session.stats.sellCount = (session.stats.sellCount || 0) + 1;
      }

      session.transactions.push({
        signature,
        type: tradeType,
        wallet: wallet.publicKey,
        solAmount,
        tokenAmount,
        price,
        timestamp: new Date(),
        solscanUrl,
      });

      // Update token stats
      const token = await TestnetToken.findOne({ mint: tokenMint.toBase58() });
      if (token) {
        token.recordTrade(tradeType, solAmount);
        await token.save();

        // Emit WebSocket events for real-time updates
        wsEvents.emitVolumeBotTrade({
          tokenMint: tokenMint.toBase58(),
          type: tradeType,
          solAmount,
          tokenAmount,
          price,
          signature,
          solscanUrl,
          sessionId,
          wallet: wallet.keypair.publicKey.toBase58(),
          timestamp: new Date().toISOString()
        });

        // Emit price update event
        wsEvents.emitPriceUpdate(
          tokenMint.toBase58(),
          price,
          token.priceChange24h || 0
        );
      }

      console.log(`[Devnet Volume Bot] ${tradeType.toUpperCase()} executed: ${solAmount} SOL`);
      console.log(`[Devnet Volume Bot] Solscan: ${solscanUrl}`);

    } catch (error) {
      console.error(`[Devnet Volume Bot] Swap failed:`, error.message);
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
