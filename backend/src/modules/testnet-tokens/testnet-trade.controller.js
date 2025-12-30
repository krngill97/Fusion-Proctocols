// ===========================================
// Fusion - Testnet Trade Controller
// Handles trade execution and history
// ===========================================

import TestnetTradeService from './testnet-trade.service.js';
import TestnetTrade from './testnet-trade.model.js';

class TestnetTradeController {

  /**
   * Estimate trade
   * POST /api/testnet/trades/estimate
   */
  async estimateTrade(req, res) {
    try {
      const { tokenMint, type, amount } = req.body;

      if (!tokenMint || !type || !amount) {
        return res.status(400).json({
          success: false,
          message: 'tokenMint, type, and amount are required'
        });
      }

      if (!['buy', 'sell'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'type must be "buy" or "sell"'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'amount must be positive'
        });
      }

      const estimate = await TestnetTradeService.estimateTrade({
        tokenMint,
        type,
        amount: parseFloat(amount)
      });

      res.json({
        success: true,
        estimate
      });

    } catch (error) {
      console.error('Estimate trade error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to estimate trade'
      });
    }
  }

  /**
   * Execute trade
   * POST /api/testnet/trades/execute
   */
  async executeTrade(req, res) {
    try {
      const { tokenMint, type, amount } = req.body;
      const wallet = req.user?.wallet || req.body.wallet;

      if (!wallet) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required'
        });
      }

      if (!tokenMint || !type || !amount) {
        return res.status(400).json({
          success: false,
          message: 'tokenMint, type, and amount are required'
        });
      }

      if (!['buy', 'sell'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'type must be "buy" or "sell"'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'amount must be positive'
        });
      }

      const result = await TestnetTradeService.executeTrade({
        tokenMint,
        wallet,
        type,
        amount: parseFloat(amount)
      });

      res.json({
        success: true,
        trade: result.trade,
        token: result.token
      });

    } catch (error) {
      console.error('Execute trade error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to execute trade'
      });
    }
  }

  /**
   * Get trades for a token
   * GET /api/testnet/trades/:mint
   */
  async getTokenTrades(req, res) {
    try {
      const { mint } = req.params;
      const { page = 1, limit = 50, type } = req.query;

      const result = await TestnetTradeService.getTokenTrades(mint, {
        page: parseInt(page),
        limit: parseInt(limit),
        type
      });

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Get token trades error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch trades',
        error: error.message
      });
    }
  }

  /**
   * Get recent trades for a token
   * GET /api/testnet/trades/:mint/recent
   */
  async getRecentTrades(req, res) {
    try {
      const { mint } = req.params;
      const { limit = 20 } = req.query;

      const trades = await TestnetTradeService.getRecentTrades(mint, parseInt(limit));

      res.json({
        success: true,
        trades
      });

    } catch (error) {
      console.error('Get recent trades error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent trades',
        error: error.message
      });
    }
  }

  /**
   * Get trades for a wallet
   * GET /api/testnet/trades/wallet/:wallet
   */
  async getWalletTrades(req, res) {
    try {
      const { wallet } = req.params;
      const { page = 1, limit = 50, tokenMint } = req.query;

      const result = await TestnetTradeService.getWalletTrades(wallet, {
        page: parseInt(page),
        limit: parseInt(limit),
        tokenMint
      });

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Get wallet trades error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch wallet trades',
        error: error.message
      });
    }
  }

  /**
   * Get trade statistics for a token
   * GET /api/testnet/trades/:mint/stats
   */
  async getTradeStats(req, res) {
    try {
      const { mint } = req.params;

      const stats = await TestnetTradeService.getTokenTradeStats(mint);

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('Get trade stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch trade stats',
        error: error.message
      });
    }
  }

  /**
   * Get 24h volume for a token
   * GET /api/testnet/trades/:mint/volume24h
   */
  async get24hVolume(req, res) {
    try {
      const { mint } = req.params;

      const volume = await TestnetTradeService.get24hVolume(mint);

      res.json({
        success: true,
        ...volume
      });

    } catch (error) {
      console.error('Get 24h volume error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch 24h volume',
        error: error.message
      });
    }
  }

  /**
   * Get a single trade by signature
   * GET /api/testnet/trades/tx/:signature
   */
  async getTradeBySignature(req, res) {
    try {
      const { signature } = req.params;

      const trade = await TestnetTrade.findOne({ signature }).lean();

      if (!trade) {
        return res.status(404).json({
          success: false,
          message: 'Trade not found'
        });
      }

      res.json({
        success: true,
        trade
      });

    } catch (error) {
      console.error('Get trade error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch trade',
        error: error.message
      });
    }
  }
}

export default new TestnetTradeController();
