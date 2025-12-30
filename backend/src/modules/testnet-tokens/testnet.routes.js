// ===========================================
// Fusion - Testnet API Routes
// All routes for testnet token trading simulator
// ===========================================

import express from 'express';
import TestnetTokenController from './testnet-token.controller.js';
import TestnetTradeController from './testnet-trade.controller.js';
import VolumeSimulatorController from './volume-simulator.controller.js';

const router = express.Router();

// ==========================================
// Token Management Routes
// ==========================================

/**
 * @route   POST /api/testnet/tokens
 * @desc    Create a new testnet token
 * @access  Public (wallet required in body)
 */
router.post('/tokens', TestnetTokenController.createToken);

/**
 * @route   GET /api/testnet/tokens
 * @desc    List tokens with pagination and filters
 * @access  Public
 */
router.get('/tokens', TestnetTokenController.listTokens);

/**
 * @route   GET /api/testnet/tokens/trending
 * @desc    Get trending tokens by volume
 * @access  Public
 */
router.get('/tokens/trending', TestnetTokenController.getTrendingTokens);

/**
 * @route   GET /api/testnet/tokens/new
 * @desc    Get newest tokens
 * @access  Public
 */
router.get('/tokens/new', TestnetTokenController.getNewTokens);

/**
 * @route   GET /api/testnet/tokens/tradable
 * @desc    Get tradable tokens (tokens with liquidity)
 * @access  Public
 */
router.get('/tokens/tradable', TestnetTokenController.getTradableTokens);

/**
 * @route   GET /api/testnet/tokens/search
 * @desc    Search tokens by name, symbol, or mint
 * @access  Public
 */
router.get('/tokens/search', TestnetTokenController.searchTokens);

/**
 * @route   GET /api/testnet/tokens/creator/:wallet
 * @desc    Get tokens created by a wallet
 * @access  Public
 */
router.get('/tokens/creator/:wallet', TestnetTokenController.getTokensByCreator);

/**
 * @route   GET /api/testnet/tokens/:mint
 * @desc    Get token by mint address
 * @access  Public
 */
router.get('/tokens/:mint', TestnetTokenController.getToken);

/**
 * @route   GET /api/testnet/tokens/:mint/stats
 * @desc    Get token statistics
 * @access  Public
 */
router.get('/tokens/:mint/stats', TestnetTokenController.getTokenStats);

/**
 * @route   GET /api/testnet/tokens/:mint/balance/:wallet
 * @desc    Get user balance for a token
 * @access  Public
 */
router.get('/tokens/:mint/balance/:wallet', TestnetTokenController.getUserBalance);

/**
 * @route   GET /api/testnet/tokens/:mint/holders
 * @desc    Get token holders
 * @access  Public
 */
router.get('/tokens/:mint/holders', TestnetTokenController.getTokenHolders);

/**
 * @route   GET /api/testnet/tokens/:mint/distribution
 * @desc    Get holder distribution
 * @access  Public
 */
router.get('/tokens/:mint/distribution', TestnetTokenController.getTokenDistribution);

/**
 * @route   GET /api/testnet/tokens/:mint/price-history
 * @desc    Get token price history
 * @access  Public
 */
router.get('/tokens/:mint/price-history', TestnetTokenController.getPriceHistory);

// ==========================================
// Trading Routes
// ==========================================

/**
 * @route   POST /api/testnet/trades/estimate
 * @desc    Estimate trade output and fees
 * @access  Public
 */
router.post('/trades/estimate', TestnetTradeController.estimateTrade);

/**
 * @route   POST /api/testnet/trades/execute
 * @desc    Execute a trade (buy or sell)
 * @access  Public (wallet required in body)
 */
router.post('/trades/execute', TestnetTradeController.executeTrade);

/**
 * @route   GET /api/testnet/trades/tx/:signature
 * @desc    Get trade by transaction signature
 * @access  Public
 */
router.get('/trades/tx/:signature', TestnetTradeController.getTradeBySignature);

/**
 * @route   GET /api/testnet/trades/wallet/:wallet
 * @desc    Get trades for a wallet
 * @access  Public
 */
router.get('/trades/wallet/:wallet', TestnetTradeController.getWalletTrades);

/**
 * @route   GET /api/testnet/trades/:mint
 * @desc    Get trades for a token
 * @access  Public
 */
router.get('/trades/:mint', TestnetTradeController.getTokenTrades);

/**
 * @route   GET /api/testnet/trades/:mint/recent
 * @desc    Get recent trades for a token
 * @access  Public
 */
router.get('/trades/:mint/recent', TestnetTradeController.getRecentTrades);

/**
 * @route   GET /api/testnet/trades/:mint/stats
 * @desc    Get trade statistics for a token
 * @access  Public
 */
router.get('/trades/:mint/stats', TestnetTradeController.getTradeStats);

/**
 * @route   GET /api/testnet/trades/:mint/volume24h
 * @desc    Get 24h volume for a token
 * @access  Public
 */
router.get('/trades/:mint/volume24h', TestnetTradeController.get24hVolume);

// ==========================================
// Volume Simulator Routes
// ==========================================

/**
 * @route   POST /api/testnet/volume/sessions
 * @desc    Start a new volume simulation session
 * @access  Public (wallet required in body)
 */
router.post('/volume/sessions', VolumeSimulatorController.startSession);

/**
 * @route   GET /api/testnet/volume/sessions
 * @desc    Get user's volume sessions
 * @access  Public (wallet required in query)
 */
router.get('/volume/sessions', VolumeSimulatorController.getUserSessions);

/**
 * @route   GET /api/testnet/volume/sessions/token/:mint
 * @desc    Get volume sessions for a token
 * @access  Public
 */
router.get('/volume/sessions/token/:mint', VolumeSimulatorController.getTokenSessions);

/**
 * @route   GET /api/testnet/volume/sessions/:id
 * @desc    Get volume session by ID
 * @access  Public
 */
router.get('/volume/sessions/:id', VolumeSimulatorController.getSession);

/**
 * @route   GET /api/testnet/volume/sessions/:id/trades
 * @desc    Get trades from a volume session
 * @access  Public
 */
router.get('/volume/sessions/:id/trades', VolumeSimulatorController.getSessionTrades);

/**
 * @route   POST /api/testnet/volume/sessions/:id/stop
 * @desc    Stop a running volume session
 * @access  Public (wallet required in body)
 */
router.post('/volume/sessions/:id/stop', VolumeSimulatorController.stopSession);

/**
 * @route   POST /api/testnet/volume/sessions/:id/pause
 * @desc    Pause a running volume session
 * @access  Public (wallet required in body)
 */
router.post('/volume/sessions/:id/pause', VolumeSimulatorController.pauseSession);

/**
 * @route   POST /api/testnet/volume/sessions/:id/resume
 * @desc    Resume a paused volume session
 * @access  Public (wallet required in body)
 */
router.post('/volume/sessions/:id/resume', VolumeSimulatorController.resumeSession);

/**
 * @route   GET /api/testnet/volume/stats
 * @desc    Get user's volume simulation stats
 * @access  Public (wallet required in query)
 */
router.get('/volume/stats', VolumeSimulatorController.getUserStats);

export default router;
