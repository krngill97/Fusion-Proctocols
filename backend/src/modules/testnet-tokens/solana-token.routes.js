/**
 * Real Solana Token Routes
 * Routes for creating and trading REAL tokens on Solana devnet/mainnet
 */

import express from 'express';
import tokenCreationService from '../../services/token-creation.service.js';
import tradingService from '../../services/trading.service.js';
import volumeBotService from '../../services/volume-bot.service.js';
import solanaConnection from '../../services/solana-connection.js';
import { Keypair, PublicKey } from '@solana/web3.js';

const router = express.Router();

// ==========================================
// Token Creation Routes
// ==========================================

/**
 * @route   POST /api/solana/tokens/create
 * @desc    Create a real SPL token on Solana
 * @body    { name, symbol, description, imageUrl, initialSupply, decimals, privateKey, network }
 */
router.post('/tokens/create', async (req, res) => {
  try {
    const {
      name,
      symbol,
      description,
      imageUrl,
      initialSupply,
      decimals = 9,
      privateKey,
      network = 'devnet',
    } = req.body;

    // Validation
    if (!name || !symbol || !privateKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, symbol, privateKey',
      });
    }

    // Create keypair from private key
    const payer = solanaConnection.keypairFromPrivateKey(privateKey);

    // Check balance
    const balance = await solanaConnection.getBalance(payer.publicKey, network);
    if (balance < 0.01) {
      return res.status(400).json({
        success: false,
        message: `Insufficient SOL balance. Required: 0.01 SOL, Current: ${balance} SOL`,
      });
    }

    // Create token
    const tokenData = await tokenCreationService.createToken({
      name,
      symbol,
      description,
      imageUrl,
      initialSupply: parseFloat(initialSupply) || 1000000,
      decimals: parseInt(decimals),
      payer,
      network,
    });

    res.json({
      success: true,
      message: 'Token created successfully on Solana blockchain',
      data: tokenData,
    });

  } catch (error) {
    console.error('[API] Token creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create token',
    });
  }
});

/**
 * @route   GET /api/solana/tokens/:mint/metadata
 * @desc    Get token metadata from blockchain
 */
router.get('/tokens/:mint/metadata', async (req, res) => {
  try {
    const { mint } = req.params;
    const { network = 'devnet' } = req.query;

    const metadata = await tokenCreationService.getTokenMetadata(mint, network);

    res.json({
      success: true,
      data: metadata,
    });

  } catch (error) {
    console.error('[API] Error fetching metadata:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/solana/tokens/:mint/balance/:wallet
 * @desc    Get token balance for a wallet
 */
router.get('/tokens/:mint/balance/:wallet', async (req, res) => {
  try {
    const { mint, wallet } = req.params;
    const { network = 'devnet' } = req.query;

    const balance = await tokenCreationService.getTokenBalance(mint, wallet, network);

    res.json({
      success: true,
      data: balance,
    });

  } catch (error) {
    console.error('[API] Error fetching balance:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/solana/tokens/:mint/holders
 * @desc    Get token holders from blockchain
 */
router.get('/tokens/:mint/holders', async (req, res) => {
  try {
    const { mint } = req.params;
    const { network = 'devnet' } = req.query;

    const holders = await tokenCreationService.getTokenHolders(mint, network);

    res.json({
      success: true,
      data: holders,
    });

  } catch (error) {
    console.error('[API] Error fetching holders:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// Trading Routes
// ==========================================

/**
 * @route   POST /api/solana/trading/quote
 * @desc    Get swap quote
 * @body    { inputMint, outputMint, amount, slippageBps, network }
 */
router.post('/trading/quote', async (req, res) => {
  try {
    const { inputMint, outputMint, amount, slippageBps = 50, network = 'devnet' } = req.body;

    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: inputMint, outputMint, amount',
      });
    }

    const quote = await tradingService.getQuote({
      inputMint,
      outputMint,
      amount: BigInt(amount),
      slippageBps,
      network,
    });

    res.json({
      success: true,
      data: quote,
    });

  } catch (error) {
    console.error('[API] Quote error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/solana/trading/swap
 * @desc    Execute a swap transaction
 * @body    { quote, privateKey, network }
 */
router.post('/trading/swap', async (req, res) => {
  try {
    const { quote, privateKey, network = 'devnet' } = req.body;

    if (!quote || !privateKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: quote, privateKey',
      });
    }

    // Create keypair
    const userKeypair = solanaConnection.keypairFromPrivateKey(privateKey);

    // Execute swap
    const result = await tradingService.executeSwap({
      quote,
      userPublicKey: userKeypair.publicKey,
      userKeypair,
      network,
    });

    res.json({
      success: true,
      message: 'Swap executed successfully',
      data: result,
    });

  } catch (error) {
    console.error('[API] Swap error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/solana/trading/history/:wallet
 * @desc    Get trade history for wallet
 */
router.get('/trading/history/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const { network = 'devnet' } = req.query;

    const history = await tradingService.getTradeHistory(wallet, network);

    res.json({
      success: true,
      data: history,
    });

  } catch (error) {
    console.error('[API] Error fetching history:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/solana/trading/price/:mint
 * @desc    Get token price
 */
router.get('/trading/price/:mint', async (req, res) => {
  try {
    const { mint } = req.params;
    const { network = 'devnet' } = req.query;

    const price = await tradingService.getTokenPrice(mint, network);

    res.json({
      success: true,
      data: price,
    });

  } catch (error) {
    console.error('[API] Error fetching price:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// Volume Bot Routes
// ==========================================

/**
 * @route   POST /api/solana/volume/start
 * @desc    Start volume generation session
 * @body    { tokenMint, targetVolume, durationMinutes, tradesPerMinute, minTradeSize, maxTradeSize, walletPrivateKeys, network }
 */
router.post('/volume/start', async (req, res) => {
  try {
    const {
      tokenMint,
      targetVolume,
      durationMinutes,
      tradesPerMinute = 2,
      minTradeSize = 0.01,
      maxTradeSize = 0.1,
      walletPrivateKeys = [],
      network = 'devnet',
    } = req.body;

    if (!tokenMint || !targetVolume || !durationMinutes) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tokenMint, targetVolume, durationMinutes',
      });
    }

    const session = await volumeBotService.startSession({
      tokenMint,
      targetVolume: parseFloat(targetVolume),
      durationMinutes: parseInt(durationMinutes),
      tradesPerMinute: parseInt(tradesPerMinute),
      minTradeSize: parseFloat(minTradeSize),
      maxTradeSize: parseFloat(maxTradeSize),
      walletPrivateKeys,
      network,
    });

    res.json({
      success: true,
      message: 'Volume generation session started',
      data: session,
    });

  } catch (error) {
    console.error('[API] Volume start error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/solana/volume/:sessionId/stop
 * @desc    Stop volume generation session
 */
router.post('/volume/:sessionId/stop', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await volumeBotService.stopSession(sessionId);

    res.json({
      success: true,
      message: 'Volume generation stopped',
      data: result,
    });

  } catch (error) {
    console.error('[API] Volume stop error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/solana/volume/:sessionId/pause
 * @desc    Pause volume generation session
 */
router.post('/volume/:sessionId/pause', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await volumeBotService.pauseSession(sessionId);

    res.json({
      success: true,
      message: 'Volume generation paused',
      data: result,
    });

  } catch (error) {
    console.error('[API] Volume pause error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/solana/volume/:sessionId/resume
 * @desc    Resume volume generation session
 */
router.post('/volume/:sessionId/resume', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await volumeBotService.resumeSession(sessionId);

    res.json({
      success: true,
      message: 'Volume generation resumed',
      data: result,
    });

  } catch (error) {
    console.error('[API] Volume resume error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/solana/volume/:sessionId
 * @desc    Get volume session details
 */
router.get('/volume/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = volumeBotService.getSession(sessionId);

    res.json({
      success: true,
      data: session,
    });

  } catch (error) {
    console.error('[API] Error fetching session:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/solana/volume/:sessionId/trades
 * @desc    Get volume session trades
 */
router.get('/volume/:sessionId/trades', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 100 } = req.query;

    const trades = volumeBotService.getSessionTrades(sessionId, parseInt(limit));

    res.json({
      success: true,
      data: trades,
    });

  } catch (error) {
    console.error('[API] Error fetching trades:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/solana/volume/:sessionId/stats
 * @desc    Get volume session statistics
 */
router.get('/volume/:sessionId/stats', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const stats = volumeBotService.getSessionStats(sessionId);

    res.json({
      success: true,
      data: stats,
    });

  } catch (error) {
    console.error('[API] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/solana/volume/sessions
 * @desc    Get all active volume sessions
 */
router.get('/volume/sessions', async (req, res) => {
  try {
    const sessions = volumeBotService.getAllSessions();

    res.json({
      success: true,
      data: sessions,
    });

  } catch (error) {
    console.error('[API] Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// Utility Routes
// ==========================================

/**
 * @route   GET /api/solana/wallet/balance/:address
 * @desc    Get SOL balance for wallet
 */
router.get('/wallet/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { network = 'devnet' } = req.query;

    const balance = await solanaConnection.getBalance(
      new PublicKey(address),
      network
    );

    res.json({
      success: true,
      data: {
        address,
        balance,
        network,
      },
    });

  } catch (error) {
    console.error('[API] Error fetching balance:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/solana/wallet/airdrop
 * @desc    Request SOL airdrop (devnet only)
 * @body    { address, amount, network }
 */
router.post('/wallet/airdrop', async (req, res) => {
  try {
    const { address, amount = 1, network = 'devnet' } = req.body;

    if (network !== 'devnet') {
      return res.status(400).json({
        success: false,
        message: 'Airdrops only available on devnet',
      });
    }

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: address',
      });
    }

    const signature = await solanaConnection.requestAirdrop(
      new PublicKey(address),
      parseFloat(amount),
      network
    );

    res.json({
      success: true,
      message: `Airdropped ${amount} SOL to ${address}`,
      data: {
        signature,
        amount,
        address,
        solscanUrl: solanaConnection.getSolscanUrl(signature, network),
      },
    });

  } catch (error) {
    console.error('[API] Airdrop error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/solana/transaction/:signature
 * @desc    Get transaction details
 */
router.get('/transaction/:signature', async (req, res) => {
  try {
    const { signature } = req.params;
    const { network = 'devnet' } = req.query;

    const transaction = await solanaConnection.getTransaction(signature, network);

    res.json({
      success: true,
      data: {
        transaction,
        solscanUrl: solanaConnection.getSolscanUrl(signature, network),
      },
    });

  } catch (error) {
    console.error('[API] Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
