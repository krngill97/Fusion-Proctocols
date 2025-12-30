// ===========================================
// Fusion - Trade Model
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// Main Trade Schema
// ------------------------------------

const TradeSchema = new Schema({
  // Reference to user
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Trade type
  type: {
    type: String,
    enum: ['buy', 'sell'],
    required: true,
    index: true
  },
  
  // Trade mode
  mode: {
    type: String,
    enum: ['manual', 'auto'],
    required: true,
    index: true
  },
  
  // Token information
  tokenMint: {
    type: String,
    required: true,
    index: true
  },
  tokenSymbol: {
    type: String,
    default: 'UNKNOWN'
  },
  tokenName: {
    type: String,
    default: 'Unknown Token'
  },
  tokenDecimals: {
    type: Number,
    default: 9
  },
  
  // Trade details
  inputMint: {
    type: String,
    required: true
  },
  outputMint: {
    type: String,
    required: true
  },
  inputAmount: {
    type: Number,
    required: true
  },
  outputAmount: {
    type: Number,
    default: 0
  },
  expectedOutputAmount: {
    type: Number,
    default: 0
  },
  
  // Price information
  pricePerToken: {
    type: Number,
    default: 0
  },
  priceImpact: {
    type: Number,
    default: 0 // Percentage
  },
  
  // Trade settings
  slippageBps: {
    type: Number,
    required: true,
    default: 100
  },
  priorityFee: {
    type: Number,
    required: true,
    default: 10000
  },
  
  // DEX used
  dex: {
    type: String,
    enum: ['jupiter', 'raydium'],
    required: true,
    index: true
  },
  
  // Route information (for Jupiter)
  route: {
    type: Schema.Types.Mixed,
    default: null
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'simulating', 'sending', 'confirming', 'confirmed', 'failed'],
    default: 'pending',
    index: true
  },
  
  // Transaction signature
  txSignature: {
    type: String,
    default: null,
    index: true
  },
  
  // Confirmation details
  slot: {
    type: Number,
    default: null
  },
  blockTime: {
    type: Date,
    default: null
  },
  confirmations: {
    type: Number,
    default: 0
  },
  
  // Fee information
  networkFee: {
    type: Number,
    default: 0 // in SOL
  },
  totalFee: {
    type: Number,
    default: 0 // network + priority in SOL
  },
  
  // Trigger information (for auto trades)
  triggeredBy: {
    type: String,
    enum: ['manual', 'mint_detected', 'buy_detected', 'pool_detected', 'take_profit', 'stop_loss', 'custom'],
    default: 'manual'
  },
  triggerSource: {
    walletAddress: String,
    signalType: String,
    signalId: Schema.Types.ObjectId
  },
  
  // Wallet used for trade
  walletUsed: {
    type: String,
    required: true
  },
  walletLabel: {
    type: String,
    default: null
  },
  
  // Error information
  errorMessage: {
    type: String,
    default: null
  },
  errorCode: {
    type: String,
    default: null
  },
  
  // Timing
  confirmedAt: {
    type: Date,
    default: null
  },
  executionTime: {
    type: Number,
    default: 0 // milliseconds from creation to confirmation
  },
  
  // Profit tracking (for sell trades)
  profit: {
    realized: {
      type: Number,
      default: null // in SOL
    },
    percentage: {
      type: Number,
      default: null
    },
    entryPrice: {
      type: Number,
      default: null
    },
    exitPrice: {
      type: Number,
      default: null
    }
  },
  
  // Notes
  notes: {
    type: String,
    maxlength: 500,
    default: ''
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ------------------------------------
// Indexes
// ------------------------------------

// Query optimization
TradeSchema.index({ userId: 1, type: 1, createdAt: -1 });
TradeSchema.index({ userId: 1, status: 1 });
TradeSchema.index({ userId: 1, tokenMint: 1, createdAt: -1 });
TradeSchema.index({ userId: 1, mode: 1, createdAt: -1 });
TradeSchema.index({ createdAt: -1 });

// TTL index - delete old trades after 30 days
TradeSchema.index(
  { createdAt: 1 },
  { 
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { status: { $in: ['confirmed', 'failed'] } }
  }
);

// ------------------------------------
// Virtuals
// ------------------------------------

TradeSchema.virtual('isComplete').get(function() {
  return ['confirmed', 'failed'].includes(this.status);
});

TradeSchema.virtual('isSuccess').get(function() {
  return this.status === 'confirmed';
});

TradeSchema.virtual('shortSignature').get(function() {
  if (!this.txSignature) return null;
  return `${this.txSignature.slice(0, 8)}...${this.txSignature.slice(-8)}`;
});

TradeSchema.virtual('solAmount').get(function() {
  // Returns SOL amount involved in trade
  if (this.type === 'buy') {
    return this.inputAmount;
  } else {
    return this.outputAmount;
  }
});

TradeSchema.virtual('tokenAmount').get(function() {
  // Returns token amount involved in trade
  if (this.type === 'buy') {
    return this.outputAmount;
  } else {
    return this.inputAmount;
  }
});

// ------------------------------------
// Methods
// ------------------------------------

/**
 * Update status
 */
TradeSchema.methods.updateStatus = async function(status, additionalData = {}) {
  this.status = status;
  
  if (additionalData.txSignature) {
    this.txSignature = additionalData.txSignature;
  }
  
  if (additionalData.error) {
    this.errorMessage = additionalData.error.message || additionalData.error;
    this.errorCode = additionalData.error.code || 'UNKNOWN';
  }
  
  if (status === 'confirmed') {
    this.confirmedAt = new Date();
    this.executionTime = this.confirmedAt - this.createdAt;
    
    if (additionalData.slot) this.slot = additionalData.slot;
    if (additionalData.blockTime) this.blockTime = additionalData.blockTime;
    if (additionalData.outputAmount) this.outputAmount = additionalData.outputAmount;
    if (additionalData.networkFee) this.networkFee = additionalData.networkFee;
  }
  
  return this.save();
};

/**
 * Calculate and set profit (for sell trades)
 */
TradeSchema.methods.calculateProfit = async function(entryPrice) {
  if (this.type !== 'sell' || this.status !== 'confirmed') {
    return this;
  }
  
  const exitPrice = this.pricePerToken;
  const tokensSold = this.inputAmount;
  
  this.profit.entryPrice = entryPrice;
  this.profit.exitPrice = exitPrice;
  this.profit.realized = (exitPrice - entryPrice) * tokensSold;
  this.profit.percentage = ((exitPrice - entryPrice) / entryPrice) * 100;
  
  return this.save();
};

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Get trades for user
 */
TradeSchema.statics.getByUser = async function(userId, options = {}) {
  const query = { userId };
  
  if (options.type) query.type = options.type;
  if (options.mode) query.mode = options.mode;
  if (options.status) query.status = options.status;
  if (options.tokenMint) query.tokenMint = options.tokenMint;
  if (options.dex) query.dex = options.dex;
  
  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) query.createdAt.$gte = options.startDate;
    if (options.endDate) query.createdAt.$lte = options.endDate;
  }
  
  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;
  
  const [trades, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
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
 * Get pending trades
 */
TradeSchema.statics.getPending = async function(userId) {
  return this.find({
    userId,
    status: { $in: ['pending', 'simulating', 'sending', 'confirming'] }
  }).sort({ createdAt: -1 });
};

/**
 * Get user trade stats
 */
TradeSchema.statics.getUserStats = async function(userId, period = 'all') {
  const matchStage = { 
    userId: new mongoose.Types.ObjectId(userId),
    status: 'confirmed'
  };
  
  // Add date filter based on period
  if (period !== 'all') {
    const periodMap = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    if (periodMap[period]) {
      matchStage.createdAt = { 
        $gte: new Date(Date.now() - periodMap[period]) 
      };
    }
  }
  
  const [stats] = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        buyCount: {
          $sum: { $cond: [{ $eq: ['$type', 'buy'] }, 1, 0] }
        },
        sellCount: {
          $sum: { $cond: [{ $eq: ['$type', 'sell'] }, 1, 0] }
        },
        manualCount: {
          $sum: { $cond: [{ $eq: ['$mode', 'manual'] }, 1, 0] }
        },
        autoCount: {
          $sum: { $cond: [{ $eq: ['$mode', 'auto'] }, 1, 0] }
        },
        totalVolume: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'buy'] },
              '$inputAmount',
              '$outputAmount'
            ]
          }
        },
        totalFees: { $sum: '$totalFee' },
        totalProfit: {
          $sum: { $ifNull: ['$profit.realized', 0] }
        },
        profitableTrades: {
          $sum: {
            $cond: [{ $gt: ['$profit.realized', 0] }, 1, 0]
          }
        },
        avgExecutionTime: { $avg: '$executionTime' },
        uniqueTokens: { $addToSet: '$tokenMint' }
      }
    },
    {
      $project: {
        totalTrades: 1,
        buyCount: 1,
        sellCount: 1,
        manualCount: 1,
        autoCount: 1,
        totalVolume: 1,
        totalFees: 1,
        totalProfit: 1,
        profitableTrades: 1,
        avgExecutionTime: 1,
        uniqueTokensCount: { $size: '$uniqueTokens' },
        winRate: {
          $cond: [
            { $gt: ['$sellCount', 0] },
            { $multiply: [{ $divide: ['$profitableTrades', '$sellCount'] }, 100] },
            0
          ]
        }
      }
    }
  ]);
  
  return stats || {
    totalTrades: 0,
    buyCount: 0,
    sellCount: 0,
    manualCount: 0,
    autoCount: 0,
    totalVolume: 0,
    totalFees: 0,
    totalProfit: 0,
    profitableTrades: 0,
    avgExecutionTime: 0,
    uniqueTokensCount: 0,
    winRate: 0
  };
};

/**
 * Get recent trades across all users (for admin)
 */
TradeSchema.statics.getRecentAll = async function(limit = 50) {
  return this.find({ status: 'confirmed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'walletAddress')
    .lean();
};

/**
 * Get trades by token
 */
TradeSchema.statics.getByToken = async function(tokenMint, options = {}) {
  const query = { tokenMint, status: 'confirmed' };
  
  if (options.userId) {
    query.userId = options.userId;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .lean();
};

/**
 * Get trade volume by day
 */
TradeSchema.statics.getVolumeByDay = async function(userId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: 'confirmed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        volume: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'buy'] },
              '$inputAmount',
              '$outputAmount'
            ]
          }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// ------------------------------------
// Pre-save Hooks
// ------------------------------------

TradeSchema.pre('save', function(next) {
  // Calculate total fee
  this.totalFee = this.networkFee + (this.priorityFee / 1e9); // Convert lamports to SOL
  next();
});

// ------------------------------------
// Export Model
// ------------------------------------

const Trade = mongoose.model('Trade', TradeSchema);

export default Trade;
export { TradeSchema };
