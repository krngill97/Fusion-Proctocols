// ===========================================
// Solscan API Routes - Real Blockchain Data
// ===========================================

import express from 'express';
import solscanService from '../services/solscan.service.js';
import blockchainMonitor from '../services/blockchain-monitor.service.js';

const router = express.Router();

/**
 * GET /api/solscan/transactions/:tokenMint
 * Fetch real transactions from Solana blockchain via RPC
 */
router.get('/transactions/:tokenMint', async (req, res) => {
  try {
    const { tokenMint } = req.params;
    const { limit = 100 } = req.query;

    const transactions = await blockchainMonitor.getTransactions(tokenMint, parseInt(limit));

    res.json({
      success: true,
      tokenMint,
      count: transactions.length,
      transactions
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/solscan/metadata/:tokenMint
 * Fetch token metadata from Solscan
 */
router.get('/metadata/:tokenMint', async (req, res) => {
  try {
    const { tokenMint } = req.params;

    const metadata = await solscanService.getTokenMetadata(tokenMint);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        message: 'Token metadata not found'
      });
    }

    res.json({
      success: true,
      tokenMint,
      metadata
    });

  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/solscan/holders/:tokenMint
 * Fetch token holders from Solscan
 */
router.get('/holders/:tokenMint', async (req, res) => {
  try {
    const { tokenMint } = req.params;
    const { limit = 100 } = req.query;

    const holders = await solscanService.getTokenHolders(tokenMint, parseInt(limit));

    res.json({
      success: true,
      tokenMint,
      count: holders.length,
      holders
    });

  } catch (error) {
    console.error('Error fetching holders:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/solscan/balance/:address
 * Get account balance
 */
router.get('/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;

    const balance = await solscanService.getAccountBalance(address);

    res.json({
      success: true,
      address,
      balance,
      balanceSOL: balance / 1e9
    });

  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/solscan/cache/clear
 * Clear cache
 */
router.post('/cache/clear', async (req, res) => {
  try {
    solscanService.clearCache();

    res.json({
      success: true,
      message: 'Cache cleared'
    });

  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/solscan/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = solscanService.getCacheStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
