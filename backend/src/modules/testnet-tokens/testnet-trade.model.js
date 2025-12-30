// ===========================================
// Fusion - Testnet Trade Model
// Records all trades on testnet tokens
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// Fee Breakdown Sub-Schema
// ------------------------------------

const FeeBreakdownSchema = new Schema({
  gasFee: {
    type: Number,
    default: 0.000005 // Simulated Solana gas fee
  },
  platformFee: {
    type: Number,
    default: 0 // 1% of trade
  },
  liquidityFee: {
    type: Number,
    default: 0 // 3% of trade
  },
  slippage: {
    type: Number,
    default: 0 // Variable based on trade size
  },
  totalFee: {
    type: Number,
    default: 0
  }
}, { _id: false });

// ------------------------------------
// Main Testnet Trade Schema
// ------------------------------------

const TestnetTradeSchema = new Schema({
  // Transaction Identity
  signature: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Token Reference
  tokenMint: {
    type: String,
    required: true,
    index: true
  },
  tokenSymbol: {
    type: String,
    default: 'UNKNOWN'
  },

  // Trader
  wallet: {
    type: String,
    required: true,
    index: true
  },

  // Trade Details
  type: {
    type: String,
    enum: ['buy', 'sell'],
    required: true,
    index: true
  },
  solAmount: {
    type: Number,
    required: true,
    min: 0
  },
  tokenAmount: {
    type: Number,
    required: true,
    min: 0
  },
  price: {
    type: Number,
    required: true // Price per token at time of trade
  },

  // Price Impact & Slippage
  priceImpact: {
    type: Number,
    default: 0 // Percentage
  },
  slippagePercent: {
    type: Number,
    default: 0
  },

  // Fee Details
  fees: {
    type: FeeBreakdownSchema,
    default: () => ({})
  },

  // For sell trades - P&L tracking
  profitLoss: {
    realized: {
      type: Number,
      default: 0 // SOL profit/loss
    },
    percentage: {
      type: Number,
      default: 0
    }
  },

  // Volume bot flag
  isVolumeBot: {
    type: Boolean,
    default: false,
    index: true
  },
  volumeSessionId: {
    type: Schema.Types.ObjectId,
    ref: 'TestnetVolumeSession',
    default: null
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'confirmed'
  },

  // Network
  network: {
    type: String,
    enum: ['devnet', 'testnet'],
    default: 'devnet'
  },

  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ------------------------------------
// Indexes
// ------------------------------------

TestnetTradeSchema.index({ tokenMint: 1, timestamp: -1 });
TestnetTradeSchema.index({ wallet: 1, timestamp: -1 });
TestnetTradeSchema.index({ tokenMint: 1, type: 1 });
TestnetTradeSchema.index({ volumeSessionId: 1 }, { sparse: true });

// TTL index - delete trades after 30 days
TestnetTradeSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

// ------------------------------------
// Virtuals
// ------------------------------------

TestnetTradeSchema.virtual('effectivePrice').get(function() {
  if (this.tokenAmount === 0) return 0;
  return this.solAmount / this.tokenAmount;
});

TestnetTradeSchema.virtual('feePercentage').get(function() {
  if (this.solAmount === 0) return 0;
  return (this.fees.totalFee / this.solAmount) * 100;
});

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Get trades for a token
 */
TestnetTradeSchema.statics.getByToken = async function(tokenMint, options = {}) {
  const { page = 1, limit = 50, type = null } = options;
  const skip = (page - 1) * limit;

  const query = { tokenMint };
  if (type) query.type = type;

  const [trades, total] = await Promise.all([
    this.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    trades,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get trades for a wallet
 */
TestnetTradeSchema.statics.getByWallet = async function(wallet, options = {}) {
  const { page = 1, limit = 50, tokenMint = null } = options;
  const skip = (page - 1) * limit;

  const query = { wallet };
  if (tokenMint) query.tokenMint = tokenMint;

  const [trades, total] = await Promise.all([
    this.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    trades,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get recent trades for a token
 */
TestnetTradeSchema.statics.getRecentByToken = async function(tokenMint, limit = 20) {
  return this.find({ tokenMint })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get trade statistics for a token
 */
TestnetTradeSchema.statics.getTokenStats = async function(tokenMint) {
  const [stats] = await this.aggregate([
    { $match: { tokenMint, status: 'confirmed' } },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        buyTrades: {
          $sum: { $cond: [{ $eq: ['$type', 'buy'] }, 1, 0] }
        },
        sellTrades: {
          $sum: { $cond: [{ $eq: ['$type', 'sell'] }, 1, 0] }
        },
        totalVolume: { $sum: '$solAmount' },
        totalTokensTraded: { $sum: '$tokenAmount' },
        totalFees: { $sum: '$fees.totalFee' },
        avgTradeSize: { $avg: '$solAmount' },
        maxTradeSize: { $max: '$solAmount' }
      }
    }
  ]);

  return stats || {
    totalTrades: 0,
    buyTrades: 0,
    sellTrades: 0,
    totalVolume: 0,
    totalTokensTraded: 0,
    totalFees: 0,
    avgTradeSize: 0,
    maxTradeSize: 0
  };
};

/**
 * Get 24h volume for a token
 */
TestnetTradeSchema.statics.get24hVolume = async function(tokenMint) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [result] = await this.aggregate([
    {
      $match: {
        tokenMint,
        status: 'confirmed',
        timestamp: { $gte: oneDayAgo }
      }
    },
    {
      $group: {
        _id: null,
        volume: { $sum: '$solAmount' },
        trades: { $sum: 1 }
      }
    }
  ]);

  return {
    volume: result?.volume || 0,
    trades: result?.trades || 0
  };
};

/**
 * Get volume bot trades for session
 */
TestnetTradeSchema.statics.getByVolumeSession = async function(sessionId) {
  return this.find({ volumeSessionId: sessionId })
    .sort({ timestamp: -1 })
    .lean();
};

// ------------------------------------
// Export Model
// ------------------------------------

const TestnetTrade = mongoose.model('TestnetTrade', TestnetTradeSchema);

export default TestnetTrade;
export { TestnetTradeSchema };
