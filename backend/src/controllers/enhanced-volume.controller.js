/**
 * Enhanced Volume Bot Controller
 * Handles API requests for enhanced volume generation with liquidity
 */

import Joi from 'joi';
import enhancedVolumeBotService from '../services/enhanced-volume-bot.service.js';

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
    walletCount: Joi.number().min(2).max(20).default(10),
    solPerWallet: Joi.number().min(0.01).max(1).default(0.3),
    tokensPerWallet: Joi.number().min(100).max(100000).default(10000),
    liquiditySOL: Joi.number().min(0.01).max(5).default(0.5),
    liquidityTokens: Joi.number().min(1000).max(1000000).default(50000),
    tradesPerMinute: Joi.number().min(1).max(20).default(5),
    durationMinutes: Joi.number().min(1).max(180).default(60),
    minTradeAmount: Joi.number().min(10).max(1000).default(100),
    maxTradeAmount: Joi.number().min(100).max(10000).default(1000),
  }).default({}),
});

class EnhancedVolumeController {
  /**
   * Start enhanced volume bot session
   * POST /api/enhanced-volume/sessions
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

      const result = await enhancedVolumeBotService.startEnhancedSession(value);

      res.status(201).json(result);

    } catch (error) {
      console.error('[Enhanced Volume Controller] Start session error:', error);

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
        message: error.message || 'Failed to start enhanced volume bot session',
      });
    }
  }

  /**
   * Get all sessions
   * GET /api/enhanced-volume/sessions
   */
  async getAllSessions(req, res) {
    try {
      const result = enhancedVolumeBotService.getAllSessions();
      res.json(result);
    } catch (error) {
      console.error('[Enhanced Volume Controller] Get all sessions error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sessions',
      });
    }
  }

  /**
   * Get session status
   * GET /api/enhanced-volume/sessions/:sessionId
   */
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;
      const result = enhancedVolumeBotService.getSession(sessionId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      console.error('[Enhanced Volume Controller] Get session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get session',
      });
    }
  }

  /**
   * Stop session
   * POST /api/enhanced-volume/sessions/:sessionId/stop
   */
  async stopSession(req, res) {
    try {
      const { sessionId } = req.params;
      const result = enhancedVolumeBotService.stopSession(sessionId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      console.error('[Enhanced Volume Controller] Stop session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to stop session',
      });
    }
  }
}

export default new EnhancedVolumeController();
