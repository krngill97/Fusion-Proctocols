/**
 * Recycling Volume Bot Controller
 * Handles API requests for the recycling volume generation system
 */

import Joi from 'joi';
import recyclingVolumeBotService from '../services/recycling-volume-bot.service.js';

// Validation schema
const startSessionSchema = Joi.object({
  tokenMint: Joi.string()
    .required()
    .min(32)
    .max(44)
    .messages({
      'string.empty': 'Token mint address is required',
      'any.required': 'Token mint address is required',
    }),
  fundingWalletPrivateKey: Joi.string()
    .required()
    .messages({
      'string.empty': 'Funding wallet private key is required',
      'any.required': 'Funding wallet private key is required',
    }),
  config: Joi.object({
    startingCapital: Joi.number().min(0.1).max(10).default(1.0),
    walletCount: Joi.number().min(5).max(20).default(20),
    tradesPerMinute: Joi.number().min(5).max(30).default(20),
    targetVolume: Joi.number().min(1).max(100).default(20),
    maxLossPercent: Joi.number().min(5).max(50).default(20),
    durationMinutes: Joi.number().min(5).max(180).default(60),
    buyRatio: Joi.number().min(0.4).max(0.8).default(0.6),
    minTradeSize: Joi.number().min(0.005).max(0.1).default(0.01),
    maxTradeSize: Joi.number().min(0.01).max(0.2).default(0.05),
  }).default({}),
});

class RecyclingVolumeController {
  /**
   * Start recycling volume bot session
   * POST /api/recycling-volume/start
   */
  async startSession(req, res) {
    try {
      // Validate request
      const { error, value } = startSessionSchema.validate(req.body, {
        abortEarly: false,
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        });
      }

      const result = await recyclingVolumeBotService.startSession(value);

      res.status(201).json(result);

    } catch (error) {
      console.error('[Recycling Volume Controller] Start session error:', error);

      // Handle specific errors
      if (error.message.includes('Insufficient SOL')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('private key') || error.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid private key format',
          details: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to start recycling volume bot session',
      });
    }
  }

  /**
   * Get session status
   * GET /api/recycling-volume/session/:sessionId
   */
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;
      const result = recyclingVolumeBotService.getSessionStats(sessionId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      console.error('[Recycling Volume Controller] Get session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get session',
      });
    }
  }

  /**
   * Stop session
   * POST /api/recycling-volume/session/:sessionId/stop
   */
  async stopSession(req, res) {
    try {
      const { sessionId } = req.params;
      recyclingVolumeBotService.stopSession(sessionId);

      res.json({
        success: true,
        message: 'Session stopped successfully',
      });

    } catch (error) {
      console.error('[Recycling Volume Controller] Stop session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to stop session',
      });
    }
  }

  /**
   * Get all active sessions
   * GET /api/recycling-volume/sessions
   */
  async getSessions(req, res) {
    try {
      const sessions = recyclingVolumeBotService.getActiveSessions();

      res.json({
        success: true,
        sessions,
      });

    } catch (error) {
      console.error('[Recycling Volume Controller] Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sessions',
      });
    }
  }
}

export default new RecyclingVolumeController();
