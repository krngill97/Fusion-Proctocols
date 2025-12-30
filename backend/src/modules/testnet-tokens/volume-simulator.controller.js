// ===========================================
// Fusion - Volume Simulator Controller
// Handles volume bot session management
// ===========================================

import VolumeSimulatorService from './volume-simulator.service.js';

class VolumeSimulatorController {

  /**
   * Start a new volume session
   * POST /api/testnet/volume/sessions
   */
  async startSession(req, res) {
    try {
      const { tokenMint, config } = req.body;
      const creator = req.user?.wallet || req.body.creator;

      if (!creator) {
        return res.status(400).json({
          success: false,
          message: 'Creator wallet address is required'
        });
      }

      if (!tokenMint) {
        return res.status(400).json({
          success: false,
          message: 'Token mint address is required'
        });
      }

      // Validate config
      const sessionConfig = {
        budget: Math.min(Math.max(config?.budget || 1, 0.1), 10),
        duration: Math.min(Math.max(config?.duration || 30, 1), 120),
        tradeInterval: Math.min(Math.max(config?.tradeInterval || 5, 1), 60),
        minTradeSize: Math.min(Math.max(config?.minTradeSize || 0.01, 0.001), 0.1),
        maxTradeSize: Math.min(Math.max(config?.maxTradeSize || 0.05, 0.01), 0.5),
        walletCount: Math.min(Math.max(config?.walletCount || 20, 5), 100),
        buyRatio: Math.min(Math.max(config?.buyRatio || 0.7, 0.5), 0.9)
      };

      // Ensure min <= max for trade size
      if (sessionConfig.minTradeSize > sessionConfig.maxTradeSize) {
        const temp = sessionConfig.minTradeSize;
        sessionConfig.minTradeSize = sessionConfig.maxTradeSize;
        sessionConfig.maxTradeSize = temp;
      }

      const session = await VolumeSimulatorService.startSession({
        tokenMint,
        creator,
        config: sessionConfig
      });

      res.status(201).json({
        success: true,
        session: {
          _id: session._id,
          sessionName: session.sessionName,
          tokenMint: session.tokenMint,
          tokenSymbol: session.tokenSymbol,
          status: session.status,
          config: session.config,
          startedAt: session.startedAt,
          scheduledEndAt: session.scheduledEndAt
        }
      });

    } catch (error) {
      console.error('Start session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to start volume session'
      });
    }
  }

  /**
   * Get session by ID
   * GET /api/testnet/volume/sessions/:id
   */
  async getSession(req, res) {
    try {
      const { id } = req.params;

      const session = await VolumeSimulatorService.getSession(id);

      res.json({
        success: true,
        session
      });

    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch session'
      });
    }
  }

  /**
   * Stop a running session
   * POST /api/testnet/volume/sessions/:id/stop
   */
  async stopSession(req, res) {
    try {
      const { id } = req.params;
      const wallet = req.user?.wallet || req.body.wallet;

      const session = await VolumeSimulatorService.getSession(id);

      // Verify ownership
      if (session.creator !== wallet) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to stop this session'
        });
      }

      const stoppedSession = await VolumeSimulatorService.stopSession(id);

      res.json({
        success: true,
        session: stoppedSession
      });

    } catch (error) {
      console.error('Stop session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to stop session'
      });
    }
  }

  /**
   * Pause a running session
   * POST /api/testnet/volume/sessions/:id/pause
   */
  async pauseSession(req, res) {
    try {
      const { id } = req.params;
      const wallet = req.user?.wallet || req.body.wallet;

      const session = await VolumeSimulatorService.getSession(id);

      // Verify ownership
      if (session.creator !== wallet) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to pause this session'
        });
      }

      const pausedSession = await VolumeSimulatorService.pauseSession(id);

      res.json({
        success: true,
        session: pausedSession
      });

    } catch (error) {
      console.error('Pause session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to pause session'
      });
    }
  }

  /**
   * Resume a paused session
   * POST /api/testnet/volume/sessions/:id/resume
   */
  async resumeSession(req, res) {
    try {
      const { id } = req.params;
      const wallet = req.user?.wallet || req.body.wallet;

      const session = await VolumeSimulatorService.getSession(id);

      // Verify ownership
      if (session.creator !== wallet) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to resume this session'
        });
      }

      const resumedSession = await VolumeSimulatorService.resumeSession(id);

      res.json({
        success: true,
        session: resumedSession
      });

    } catch (error) {
      console.error('Resume session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to resume session'
      });
    }
  }

  /**
   * Get sessions for user
   * GET /api/testnet/volume/sessions
   */
  async getUserSessions(req, res) {
    try {
      const wallet = req.user?.wallet || req.query.wallet;
      const { page = 1, limit = 20, status } = req.query;

      if (!wallet) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required'
        });
      }

      const result = await VolumeSimulatorService.getSessionsByCreator(wallet, {
        page: parseInt(page),
        limit: parseInt(limit),
        status
      });

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Get user sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sessions',
        error: error.message
      });
    }
  }

  /**
   * Get sessions for token
   * GET /api/testnet/volume/sessions/token/:mint
   */
  async getTokenSessions(req, res) {
    try {
      const { mint } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await VolumeSimulatorService.getSessionsByToken(mint, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Get token sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sessions',
        error: error.message
      });
    }
  }

  /**
   * Get user stats
   * GET /api/testnet/volume/stats
   */
  async getUserStats(req, res) {
    try {
      const wallet = req.user?.wallet || req.query.wallet;

      if (!wallet) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required'
        });
      }

      const stats = await VolumeSimulatorService.getCreatorStats(wallet);

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stats',
        error: error.message
      });
    }
  }

  /**
   * Get session trades
   * GET /api/testnet/volume/sessions/:id/trades
   */
  async getSessionTrades(req, res) {
    try {
      const { id } = req.params;
      const { limit = 100 } = req.query;

      const session = await VolumeSimulatorService.getSession(id);

      // Return recent trades from session
      const trades = session.trades?.slice(-parseInt(limit)) || [];

      res.json({
        success: true,
        trades: trades.reverse()
      });

    } catch (error) {
      console.error('Get session trades error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch trades',
        error: error.message
      });
    }
  }
}

export default new VolumeSimulatorController();
