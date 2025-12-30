/**
 * Devnet Volume Bot Controller
 * Handles API requests for devnet volume generation
 */

import devnetVolumeBotService from '../services/devnet-volume-bot.service.js';

class DevnetVolumeController {
  /**
   * Start a new devnet volume session
   * POST /api/devnet-volume/sessions
   */
  async startSession(req, res) {
    try {
      const { tokenMint, fundingWalletPrivateKey, config } = req.body;

      if (!tokenMint) {
        return res.status(400).json({
          success: false,
          message: 'Token mint address is required',
        });
      }

      if (!fundingWalletPrivateKey) {
        return res.status(400).json({
          success: false,
          message: 'Funding wallet private key is required',
        });
      }

      const result = await devnetVolumeBotService.startSession({
        tokenMint,
        fundingWalletPrivateKey,
        config,
      });

      res.status(201).json({
        success: true,
        data: result,
      });

    } catch (error) {
      console.error('Start devnet volume session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to start volume session',
      });
    }
  }

  /**
   * Get session details
   * GET /api/devnet-volume/sessions/:sessionId
   */
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;

      const session = devnetVolumeBotService.getSession(sessionId);

      res.json({
        success: true,
        data: session,
      });

    } catch (error) {
      console.error('Get devnet volume session error:', error);
      res.status(404).json({
        success: false,
        message: error.message || 'Session not found',
      });
    }
  }

  /**
   * Stop a session
   * POST /api/devnet-volume/sessions/:sessionId/stop
   */
  async stopSession(req, res) {
    try {
      const { sessionId } = req.params;

      const session = devnetVolumeBotService.stopSession(sessionId);

      res.json({
        success: true,
        data: session,
      });

    } catch (error) {
      console.error('Stop devnet volume session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to stop session',
      });
    }
  }

  /**
   * Get all sessions
   * GET /api/devnet-volume/sessions
   */
  async getAllSessions(req, res) {
    try {
      const sessions = devnetVolumeBotService.getAllSessions();

      res.json({
        success: true,
        data: sessions,
      });

    } catch (error) {
      console.error('Get all devnet volume sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sessions',
      });
    }
  }
}

export default new DevnetVolumeController();
