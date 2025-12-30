// ===========================================
// Fusion - Validation Schemas (Joi)
// ===========================================

import Joi from 'joi';
import { TRADING_CONFIG, VOLUME_CONFIG } from '../../config/constants.js';

// ------------------------------------
// Custom Validators
// ------------------------------------

// Solana public key validator
const solanaPublicKey = Joi.string()
  .pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
  .messages({
    'string.pattern.base': 'Invalid Solana public key format'
  });

// Transaction signature validator
const txSignature = Joi.string()
  .pattern(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/)
  .messages({
    'string.pattern.base': 'Invalid transaction signature format'
  });

// ------------------------------------
// Auth Schemas
// ------------------------------------

export const authSchemas = {
  // Wallet signature verification
  verifySignature: Joi.object({
    publicKey: solanaPublicKey.required(),
    signature: Joi.string().required(),
    message: Joi.string().required(),
    timestamp: Joi.number().required()
  }),

  // Refresh token
  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  })
};

// ------------------------------------
// Hot Wallet Schemas
// ------------------------------------

export const hotWalletSchemas = {
  // Add hot wallet
  add: Joi.object({
    address: solanaPublicKey.required(),
    exchange: Joi.string().max(50).required(),
    label: Joi.string().max(100).optional()
  }),

  // Update hot wallet
  update: Joi.object({
    exchange: Joi.string().max(50).optional(),
    label: Joi.string().max(100).optional(),
    isActive: Joi.boolean().optional()
  }),

  // List hot wallets query
  list: Joi.object({
    exchange: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
    limit: Joi.number().min(1).max(100).default(20),
    page: Joi.number().min(1).default(1)
  })
};

// ------------------------------------
// Subwallet Schemas
// ------------------------------------

export const subwalletSchemas = {
  // List subwallets query
  list: Joi.object({
    status: Joi.string().valid('watching', 'active', 'inactive', 'archived').optional(),
    hotWalletId: Joi.string().optional(),
    hasActivity: Joi.boolean().optional(),
    limit: Joi.number().min(1).max(100).default(20),
    page: Joi.number().min(1).default(1)
  }),

  // Update subwallet
  update: Joi.object({
    status: Joi.string().valid('watching', 'active', 'inactive', 'archived').optional()
  })
};

// ------------------------------------
// User Wallet Schemas
// ------------------------------------

export const userWalletSchemas = {
  // Add wallet to track
  add: Joi.object({
    address: solanaPublicKey.required(),
    label: Joi.string().max(100).optional()
  }),

  // Update wallet
  update: Joi.object({
    label: Joi.string().max(100).optional(),
    isActive: Joi.boolean().optional()
  }),

  // List wallets query
  list: Joi.object({
    isActive: Joi.boolean().optional(),
    limit: Joi.number().min(1).max(50).default(20),
    page: Joi.number().min(1).default(1)
  })
};

// ------------------------------------
// Trading Schemas
// ------------------------------------

export const tradingSchemas = {
  // Execute trade
  execute: Joi.object({
    tokenMint: solanaPublicKey.required(),
    type: Joi.string().valid('buy', 'sell').required(),
    amount: Joi.number()
      .min(TRADING_CONFIG.MIN_TRADE_SOL)
      .max(TRADING_CONFIG.MAX_MANUAL_TRADE_SOL)
      .required(),
    slippageBps: Joi.number()
      .min(10)
      .max(TRADING_CONFIG.MAX_SLIPPAGE_BPS)
      .default(TRADING_CONFIG.DEFAULT_SLIPPAGE_BPS),
    priorityFee: Joi.number()
      .min(0)
      .max(1000000)
      .default(TRADING_CONFIG.DEFAULT_PRIORITY_FEE),
    dex: Joi.string().valid('jupiter', 'raydium', 'auto').default('auto'),
    walletId: Joi.string().optional() // Use specific trading wallet
  }),

  // Update auto-trade settings
  autoTradeSettings: Joi.object({
    enabled: Joi.boolean().optional(),
    maxSolPerTrade: Joi.number()
      .min(TRADING_CONFIG.MIN_TRADE_SOL)
      .max(TRADING_CONFIG.MAX_AUTO_TRADE_SOL)
      .optional(),
    takeProfitPercent: Joi.number().min(1).max(1000).optional(),
    stopLossPercent: Joi.number().min(1).max(100).optional(),
    enabledTriggers: Joi.array()
      .items(Joi.string().valid('mint', 'buy', 'pool'))
      .optional(),
    slippageBps: Joi.number()
      .min(10)
      .max(TRADING_CONFIG.MAX_SLIPPAGE_BPS)
      .optional(),
    priorityFee: Joi.number().min(0).max(1000000).optional()
  }),

  // Add trading wallet
  addTradingWallet: Joi.object({
    privateKey: Joi.string().required(), // Base58 or JSON array
    label: Joi.string().max(100).optional()
  }),

  // Trade history query
  history: Joi.object({
    type: Joi.string().valid('buy', 'sell').optional(),
    mode: Joi.string().valid('manual', 'auto').optional(),
    status: Joi.string().valid('pending', 'confirmed', 'failed').optional(),
    tokenMint: solanaPublicKey.optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    limit: Joi.number().min(1).max(100).default(20),
    page: Joi.number().min(1).default(1)
  })
};

// ------------------------------------
// Volume Bot Schemas
// ------------------------------------

export const volumeSchemas = {
  // Create volume session
  create: Joi.object({
    tokenMint: solanaPublicKey.required(),
    depositAmount: Joi.number()
      .min(VOLUME_CONFIG.MIN_DEPOSIT)
      .max(VOLUME_CONFIG.MAX_DEPOSIT)
      .required(),
    config: Joi.object({
      maxDuration: Joi.number()
        .min(VOLUME_CONFIG.MIN_DURATION * 60 * 1000) // Convert minutes to milliseconds
        .max(VOLUME_CONFIG.MAX_DURATION * 60 * 1000)
        .optional(),
      walletCount: Joi.number()
        .min(VOLUME_CONFIG.MIN_WALLETS)
        .max(VOLUME_CONFIG.MAX_WALLETS)
        .optional(),
      txFrequency: Joi.number()
        .min(VOLUME_CONFIG.MIN_TX_FREQUENCY)
        .max(VOLUME_CONFIG.MAX_TX_FREQUENCY)
        .optional(),
      minTradeAmount: Joi.number()
        .min(VOLUME_CONFIG.MIN_TX_AMOUNT)
        .max(VOLUME_CONFIG.MAX_TX_AMOUNT)
        .optional(),
      maxTradeAmount: Joi.number()
        .min(VOLUME_CONFIG.MIN_TX_AMOUNT)
        .max(VOLUME_CONFIG.MAX_TX_AMOUNT)
        .optional(),
      slippageBps: Joi.number().min(10).max(5000).optional(),
      priorityFee: Joi.number().min(0).max(1000000).optional()
    }).optional(),
    network: Joi.string().valid('devnet', 'testnet', 'mainnet-beta').default('devnet')
  }),

  // Update session
  update: Joi.object({
    status: Joi.string().valid('paused', 'active').optional()
  }),

  // List sessions query
  list: Joi.object({
    status: Joi.string().valid('pending', 'initializing', 'running', 'active', 'paused', 'completed', 'failed', 'cancelled').optional(),
    network: Joi.string().valid('devnet', 'testnet', 'mainnet-beta').optional(),
    limit: Joi.number().min(1).max(50).default(20),
    page: Joi.number().min(1).default(1)
  })
};

// ------------------------------------
// User Preferences Schemas
// ------------------------------------

export const preferencesSchemas = {
  update: Joi.object({
    theme: Joi.string().valid('light', 'dark').optional(),
    defaultSlippage: Joi.number()
      .min(10)
      .max(TRADING_CONFIG.MAX_SLIPPAGE_BPS)
      .optional(),
    defaultPriorityFee: Joi.number().min(0).max(1000000).optional(),
    notifications: Joi.object({
      onMint: Joi.boolean().optional(),
      onBuy: Joi.boolean().optional(),
      onSell: Joi.boolean().optional(),
      onPoolCreation: Joi.boolean().optional()
    }).optional()
  })
};

// ------------------------------------
// Common Query Schemas
// ------------------------------------

export const commonSchemas = {
  // Pagination
  pagination: Joi.object({
    limit: Joi.number().min(1).max(100).default(20),
    page: Joi.number().min(1).default(1)
  }),

  // ID parameter
  idParam: Joi.object({
    id: Joi.string().required()
  }),

  // Address parameter
  addressParam: Joi.object({
    address: solanaPublicKey.required()
  }),

  // Date range
  dateRange: Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional()
  })
};

// ------------------------------------
// Validation Middleware Helper
// ------------------------------------

export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    // DEBUG: Log what we're validating
    console.log(`[VALIDATION] Validating ${property}:`, JSON.stringify(req[property]));

    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true  // Enable automatic type coercion (string "50" -> number 50)
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      // DEBUG: Log validation error
      console.log('[VALIDATION ERROR]:', JSON.stringify(errors));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Replace with validated/sanitized values
    req[property] = value;
    next();
  };
};

export default {
  authSchemas,
  hotWalletSchemas,
  subwalletSchemas,
  userWalletSchemas,
  tradingSchemas,
  volumeSchemas,
  preferencesSchemas,
  commonSchemas,
  validate
};
