/**
 * Devnet Volume Bot Controller
 * Handles API requests for devnet volume generation
 */

import Joi from 'joi';
import devnetVolumeBotService from '../services/devnet-volume-bot.service.js';

// Validation schema for starting a volume session
const startSessionSchema = Joi.object({
  tokenMint: Joi.string()
    .required()
    .min(32)
    .max(44)
    .messages({
      'string.empty': 'Token mint address is required',
      'string.min': 'Token mint address must be at least 32 characters',
      'string.max': 'Token mint address must not exceed 44 characters',
      'any.required': 'Token mint address is required',
    }),
  fundingWalletPrivateKey: Joi.string()
    .required()
    .messages({
      'string.empty': 'Funding wallet private key is required',
      'any.required': 'Funding wallet private key is required',
    }),
  config: Joi.object({
    walletCount: Joi.number()
      .integer()
      .min(2)
      .max(20)
      .default(5)
      .messages({
        'number.min': 'Wallet count must be at least 2',
        'number.max': 'Wallet count cannot exceed 20',
      }),
    tradesPerMinute: Joi.number()
      .min(1)
      .max(10)
      .default(2)
      .messages({
        'number.min': 'Trades per minute must be at least 1',
        'number.max': 'Trades per minute cannot exceed 10',
      }),
    durationMinutes: Joi.number()
      .integer()
      .min(1)
      .max(180)
      .default(30)
      .messages({
        'number.min': 'Duration must be at least 1 minute',
        'number.max': 'Duration cannot exceed 180 minutes',
      }),

    // Transfer-based volume (for tokens without liquidity)
    minTransferAmount: Joi.number()
      .min(1)
      .default(10)
      .messages({
        'number.min': 'Minimum transfer amount must be at least 1',
      }),
    maxTransferAmount: Joi.number()
      .min(1)
      .default(100)
      .messages({
        'number.min': 'Maximum transfer amount must be at least 1',
      }),

    // Swap-based volume (for tokens with liquidity pools)
    useSwaps: Joi.boolean()
      .default(true)
      .description('Use real Jupiter swaps if token has liquidity pool'),
    minSolAmount: Joi.number()
      .min(0.001)
      .max(1)
      .default(0.01)
      .messages({
        'number.min': 'Minimum SOL amount must be at least 0.001',
        'number.max': 'Maximum SOL amount cannot exceed 1',
      }),
    maxSolAmount: Joi.number()
      .min(0.001)
      .max(10)
      .default(0.1)
      .messages({
        'number.min': 'Maximum SOL amount must be at least 0.001',
        'number.max': 'Maximum SOL amount cannot exceed 10',
      }),
    minTokenAmount: Joi.number()
      .min(1)
      .default(10)
      .messages({
        'number.min': 'Minimum token amount must be at least 1',
      }),
    maxTokenAmount: Joi.number()
      .min(1)
      .default(1000)
      .messages({
        'number.min': 'Maximum token amount must be at least 1',
      }),
    buyProbability: Joi.number()
      .min(0)
      .max(1)
      .default(0.5)
      .messages({
        'number.min': 'Buy probability must be between 0 and 1',
        'number.max': 'Buy probability must be between 0 and 1',
      })
      .description('Probability of buy vs sell (0.5 = 50/50, 0.7 = 70% buys)'),
  }).default(),
});

class DevnetVolumeController {
  /**
   * Start a new devnet volume session
   * POST /api/devnet-volume/sessions
   */
  async startSession(req, res) {
    try {
      // Validate request body
      const { error, value } = startSessionSchema.validate(req.body, {
        abortEarly: false, // Return all errors, not just the first one
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

      const { tokenMint, fundingWalletPrivateKey, config } = value;

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

      // Check if it's a private key parsing error
      if (error.message.includes('private key') || error.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid private key format',
          details: error.message,
          hint: 'Private key should be either a base58 string or JSON array format like "[123,45,67,...]"',
        });
      }

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
