/**
 * Chart Routes
 * API routes for chart data
 */

import express from 'express';
import chartController from './chart.controller.js';

const router = express.Router();

/**
 * @route   GET /api/charts/ohlcv/:tokenMint
 * @desc    Get OHLCV candles for a token
 * @query   timeframe (1m, 5m, 15m, 1h, 4h, 1d), limit
 * @access  Public
 */
router.get('/ohlcv/:tokenMint', chartController.getOHLCV);

/**
 * @route   GET /api/charts/price/:tokenMint
 * @desc    Get latest price for a token
 * @access  Public
 */
router.get('/price/:tokenMint', chartController.getLatestPrice);

/**
 * @route   GET /api/charts/price-change/:tokenMint
 * @desc    Get price change for a token
 * @query   period (1h, 24h, 7d, 30d)
 * @access  Public
 */
router.get('/price-change/:tokenMint', chartController.getPriceChange);

/**
 * @route   GET /api/charts/volume/:tokenMint
 * @desc    Get volume data for a token
 * @query   period (1h, 24h, 7d, 30d)
 * @access  Public
 */
router.get('/volume/:tokenMint', chartController.getVolume);

/**
 * @route   GET /api/charts/complete/:tokenMint
 * @desc    Get complete chart data (OHLCV + price + volume)
 * @query   timeframe, limit
 * @access  Public
 */
router.get('/complete/:tokenMint', chartController.getCompleteChartData);

/**
 * @route   GET /api/charts/stats/:tokenMint
 * @desc    Get 24h statistics for a token
 * @access  Public
 */
router.get('/stats/:tokenMint', chartController.get24hStats);

/**
 * @route   GET /api/charts/trades/:tokenMint
 * @desc    Get recent trades for a token
 * @query   limit (default: 100)
 * @access  Public
 */
router.get('/trades/:tokenMint', chartController.getRecentTrades);

export default router;
