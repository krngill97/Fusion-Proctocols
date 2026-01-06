/**
 * Hybrid Recycling Volume Bot Controller
 * Handles API requests for hybrid recycling volume generation
 */

import Joi from 'joi';
import hybridRecyclingVolumeBotService from '../services/hybrid-recycling-volume-bot.service.js';

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
    startingCapital: Joi.number().min(0.05).max(10).default(1.0),
    walletCount: Joi.number().min(5).max(50).default(20),
    tradesPerMinute: Joi.number().min(1).max(50).default(20),
    targetVolume: Joi.number().min(0.1).max(1000).default(20),
    maxLossPercent: Joi.number().min(5).max(50).default(20),
    durationMinutes: Joi.number().min(1).max(480).default(60),
    buyRatio: Joi.number().min(0.3).max(0.7).default(0.55),
    minTradeSize: Joi.number().min(0.005).max(1).default(0.01),
    maxTradeSize: Joi.number().min(0.01).max(5).default(0.05),
    slippageBps: Joi.number().min(100).max(1000).default(300),
    parallelTrades: Joi.number().min(1).max(10).default(3),
    enableDynamicSlippage: Joi.boolean().default(true),
  }).default({}),
});

class HybridRecyclingVolumeController {
  /**
   * Start hybrid recycling volume bot session
   * POST /api/hybrid-recycling-volume/start
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

      const result = await hybridRecyclingVolumeBotService.startSession(value);

      res.status(201).json(result);

    } catch (error) {
      console.error('[Hybrid Recycling Volume Controller] Start session error:', error);

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
        message: 'Failed to start hybrid recycling volume bot session',
        error: error.message,
      });
    }
  }

  /**
   * Get all active sessions
   * GET /api/hybrid-recycling-volume/sessions
   */
  async getSessions(req, res) {
    try {
      const sessions = hybridRecyclingVolumeBotService.getActiveSessions();

      res.json({
        success: true,
        sessions,
      });

    } catch (error) {
      console.error('[Hybrid Recycling Volume Controller] Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get sessions',
        error: error.message,
      });
    }
  }

  /**
   * Get session status
   * GET /api/hybrid-recycling-volume/session/:sessionId
   */
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;
      const result = hybridRecyclingVolumeBotService.getSessionStats(sessionId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      console.error('[Hybrid Recycling Volume Controller] Get session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get session',
        error: error.message,
      });
    }
  }

  /**
   * Stop session
   * POST /api/hybrid-recycling-volume/session/:sessionId/stop
   */
  async stopSession(req, res) {
    try {
      const { sessionId } = req.params;
      hybridRecyclingVolumeBotService.stopSession(sessionId);

      res.json({
        success: true,
        message: 'Session stopped',
      });

    } catch (error) {
      console.error('[Hybrid Recycling Volume Controller] Stop session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to stop session',
        error: error.message,
      });
    }
  }
}

export default new HybridRecyclingVolumeController();
