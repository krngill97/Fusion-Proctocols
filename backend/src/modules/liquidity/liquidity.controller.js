/**
 * Liquidity Controller
 * Handles API requests for liquidity pool management
 */

import Joi from 'joi';
import liquidityService from './liquidity.service.js';
// TEMPORARILY DISABLED - CommonJS import issue
// import raydiumPoolService from '../../services/raydium-pool.service.js';
import simplePoolService from '../../services/simple-pool.service.js';

// Validation schema for creating a pool
const createPoolSchema = Joi.object({
  tokenMint: Joi.string()
    .required()
    .min(32)
    .max(44)
    .messages({
      'string.empty': 'Token mint address is required',
      'any.required': 'Token mint address is required',
    }),
  solAmount: Joi.number()
    .min(0.01)
    .max(1000)
    .required()
    .messages({
      'number.min': 'SOL amount must be at least 0.01',
      'number.max': 'SOL amount cannot exceed 1000',
      'any.required': 'SOL amount is required',
    }),
  tokenAmount: Joi.number()
    .min(1)
    .required()
    .messages({
      'number.min': 'Token amount must be at least 1',
      'any.required': 'Token amount is required',
    }),
  walletPrivateKey: Joi.string()
    .required()
    .messages({
      'string.empty': 'Wallet private key is required',
      'any.required': 'Wallet private key is required',
    }),
  network: Joi.string()
    .valid('devnet', 'testnet', 'mainnet-beta')
    .default('devnet'),
});

// Validation schema for adding liquidity
const addLiquiditySchema = Joi.object({
  poolAddress: Joi.string()
    .required()
    .messages({
      'string.empty': 'Pool address is required',
      'any.required': 'Pool address is required',
    }),
  solAmount: Joi.number()
    .min(0.01)
    .required()
    .messages({
      'number.min': 'SOL amount must be at least 0.01',
      'any.required': 'SOL amount is required',
    }),
  tokenAmount: Joi.number()
    .min(1)
    .required()
    .messages({
      'number.min': 'Token amount must be at least 1',
      'any.required': 'Token amount is required',
    }),
  walletPrivateKey: Joi.string()
    .required()
    .messages({
      'string.empty': 'Wallet private key is required',
      'any.required': 'Wallet private key is required',
    }),
});

class LiquidityController {
  /**
   * Create a new liquidity pool
   * POST /api/liquidity/create-pool
   */
  async createPool(req, res) {
    try {
      // Validate request body
      const { error, value } = createPoolSchema.validate(req.body, {
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

      const result = await liquidityService.createPool(value);

      res.status(201).json(result);

    } catch (error) {
      console.error('Create pool error:', error);

      // Check for specific error types
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('private key') || error.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid private key format',
          details: error.message,
          hint: 'Private key should be either a base58 string or JSON array format',
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create pool',
      });
    }
  }

  /**
   * Get pool information
   * GET /api/liquidity/pool/:poolAddress
   */
  async getPool(req, res) {
    try {
      const { poolAddress } = req.params;

      const result = await liquidityService.getPoolInfo(poolAddress);

      res.json(result);

    } catch (error) {
      console.error('Get pool error:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get pool info',
      });
    }
  }

  /**
   * Get pool by token mint
   * GET /api/liquidity/token/:tokenMint
   */
  async getPoolByToken(req, res) {
    try {
      const { tokenMint } = req.params;

      const result = await liquidityService.getPoolByToken(tokenMint);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      console.error('Get pool by token error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get pool',
      });
    }
  }

  /**
   * Add liquidity to existing pool
   * POST /api/liquidity/add
   */
  async addLiquidity(req, res) {
    try {
      // Validate request body
      const { error, value } = addLiquiditySchema.validate(req.body, {
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

      const result = await liquidityService.addLiquidity(value);

      res.json(result);

    } catch (error) {
      console.error('Add liquidity error:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add liquidity',
      });
    }
  }

  /**
   * Get pools by creator
   * GET /api/liquidity/creator/:creatorAddress
   */
  async getPoolsByCreator(req, res) {
    try {
      const { creatorAddress } = req.params;

      const result = await liquidityService.getPoolsByCreator(creatorAddress);

      res.json(result);

    } catch (error) {
      console.error('Get pools by creator error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get pools',
      });
    }
  }

  /**
   * Create a REAL Raydium pool on-chain
   * POST /api/liquidity/create-raydium-pool
   *
   * WARNING: Requires ~1.5 SOL minimum
   */
  async createRaydiumPool(req, res) {
    try {
      // Validate request body
      const { error, value } = createPoolSchema.validate(req.body, {
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

      console.log('[Liquidity Controller] Creating REAL Raydium pool...');

      // TEMPORARILY DISABLED - Raydium SDK import issue
      return res.status(503).json({
        success: false,
        message: 'Raydium pool creation temporarily disabled due to SDK compatibility issues',
        hint: 'Use the simple pool creation endpoint instead'
      });

      // const result = await raydiumPoolService.createCompletePool({
      //   privateKey: value.walletPrivateKey,
      //   tokenMint: value.tokenMint,
      //   solAmount: value.solAmount,
      //   tokenAmount: value.tokenAmount,
      //   network: value.network || 'devnet'
      // });
      //
      // res.status(201).json(result);

    } catch (error) {
      console.error('Create Raydium pool error:', error);

      // SOL balance errors
      if (error.message.includes('Insufficient SOL')) {
        return res.status(400).json({
          success: false,
          message: error.message,
          hint: 'Raydium pool creation requires approximately 1.5 SOL for rent + liquidity. Request more SOL from devnet faucet.',
        });
      }

      // Private key errors
      if (error.message.includes('private key') || error.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid private key format',
          details: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create Raydium pool',
      });
    }
  }

  /**
   * Create a simple pool (database tracking only)
   * POST /api/liquidity/create-simple-pool
   *
   * For testing with low SOL balance (<1 SOL)
   */
  async createSimplePool(req, res) {
    try {
      // Validate request body
      const { error, value } = createPoolSchema.validate(req.body, {
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

      console.log('[Liquidity Controller] Creating simple pool (tracking only)...');

      const result = await simplePoolService.createSimplePool({
        privateKey: value.walletPrivateKey,
        tokenMint: value.tokenMint,
        solAmount: value.solAmount,
        tokenAmount: value.tokenAmount,
        network: value.network || 'devnet'
      });

      res.status(201).json(result);

    } catch (error) {
      console.error('Create simple pool error:', error);

      if (error.message.includes('Insufficient')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create simple pool',
      });
    }
  }

  /**
   * Check if token has real liquidity on Jupiter
   * GET /api/liquidity/check-jupiter/:tokenMint
   */
  async checkJupiterLiquidity(req, res) {
    try {
      const { tokenMint } = req.params;
      const { network = 'devnet' } = req.query;

      const result = await simplePoolService.checkRealLiquidity(tokenMint, network);

      res.json({
        success: true,
        tokenMint,
        ...result
      });

    } catch (error) {
      console.error('Check Jupiter liquidity error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to check Jupiter liquidity',
      });
    }
  }
}

export default new LiquidityController();
