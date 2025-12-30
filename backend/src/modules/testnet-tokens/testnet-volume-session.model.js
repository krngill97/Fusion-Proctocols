// ===========================================
// Fusion - Testnet Volume Session Model
// Volume bot simulation sessions for testnet
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// Session Config Sub-Schema
// ------------------------------------

const SessionConfigSchema = new Schema({
  budget: {
    type: Number,
    required: true,
    min: 0.1,
    max: 10 // Max 10 SOL for testnet
  },
  duration: {
    type: Number,
    required: true,
    min: 1,
    max: 120 // Max 2 hours
  },
  tradeInterval: {
    type: Number,
    required: true,
    default: 5, // Seconds between trades
    min: 1,
    max: 60
  },
  minTradeSize: {
    type: Number,
    required: true,
    default: 0.01,
    min: 0.001
  },
  maxTradeSize: {
    type: Number,
    required: true,
    default: 0.05,
    max: 0.5
  },
  walletCount: {
    type: Number,
    required: true,
    default: 20,
    min: 5,
    max: 100
  },
  buyRatio: {
    type: Number,
    default: 0.7, // 70% buys, 30% sells
    min: 0.5,
    max: 0.9
  }
}, { _id: false });

// ------------------------------------
// Session Metrics Sub-Schema
// ------------------------------------

const SessionMetricsSchema = new Schema({
  totalVolume: {
    type: Number,
    default: 0
  },
  totalTrades: {
    type: Number,
    default: 0
  },
  buyTrades: {
    type: Number,
    default: 0
  },
  sellTrades: {
    type: Number,
    default: 0
  },
  uniqueHolders: {
    type: Number,
    default: 0
  },
  activeHolders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  totalFees: {
    type: Number,
    default: 0
  },
  averageTradeSize: {
    type: Number,
    default: 0
  },
  startPrice: {
    type: Number,
    default: 0
  },
  endPrice: {
    type: Number,
    default: 0
  },
  priceChange: {
    type: Number,
    default: 0 // Percentage
  },
  maxPriceReached: {
    type: Number,
    default: 0
  },
  tradesPerMinute: {
    type: Number,
    default: 0
  },
  volumePerMinute: {
    type: Number,
    default: 0
  },
  volumeMultiplier: {
    type: Number,
    default: 0 // Volume / Budget ratio
  },
  feePercentage: {
    type: Number,
    default: 0
  }
}, { _id: false });

// ------------------------------------
// Trade Log Sub-Schema
// ------------------------------------

const TradeLogSchema = new Schema({
  tradeId: {
    type: Schema.Types.ObjectId,
    ref: 'TestnetTrade'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['buy', 'sell']
  },
  wallet: String,
  solAmount: Number,
  tokenAmount: Number,
  price: Number
}, { _id: false });

// ------------------------------------
// Holder Distribution Sub-Schema
// ------------------------------------

const HolderDistributionSchema = new Schema({
  wallet: String,
  balance: Number,
  percentage: Number
}, { _id: false });

// ------------------------------------
// Error Log Sub-Schema
// ------------------------------------

const ErrorLogSchema = new Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  error: String,
  context: String
}, { _id: false });

// ------------------------------------
// Main Volume Session Schema
// ------------------------------------

const TestnetVolumeSessionSchema = new Schema({
  // Session Identity
  sessionName: {
    type: String,
    default: function() {
      return `Volume Session ${new Date().toLocaleString()}`;
    }
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

  // Creator
  creator: {
    type: String,
    required: true,
    index: true
  },

  // Configuration
  config: {
    type: SessionConfigSchema,
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'running', 'paused', 'completed', 'stopped', 'failed'],
    default: 'pending',
    index: true
  },

  // Metrics
  metrics: {
    type: SessionMetricsSchema,
    default: () => ({})
  },

  // Generated Wallets
  generatedWallets: [{
    address: String,
    balance: {
      type: Number,
      default: 0
    },
    tokenBalance: {
      type: Number,
      default: 0
    }
  }],

  // Trade Logs (last 500)
  trades: {
    type: [TradeLogSchema],
    default: []
  },

  // Holder Distribution
  holderDistribution: {
    type: [HolderDistributionSchema],
    default: []
  },

  // Error Logs
  errors: {
    type: [ErrorLogSchema],
    default: []
  },

  // Timing
  startedAt: {
    type: Date,
    default: null
  },
  pausedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  scheduledEndAt: {
    type: Date,
    default: null
  },

  // Network
  network: {
    type: String,
    enum: ['devnet', 'testnet'],
    default: 'devnet'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ------------------------------------
// Indexes
// ------------------------------------

TestnetVolumeSessionSchema.index({ creator: 1, createdAt: -1 });
TestnetVolumeSessionSchema.index({ tokenMint: 1, status: 1 });
TestnetVolumeSessionSchema.index({ status: 1, createdAt: -1 });

// TTL index - delete completed sessions after 7 days
TestnetVolumeSessionSchema.index(
  { completedAt: 1 },
  {
    expireAfterSeconds: 7 * 24 * 60 * 60,
    partialFilterExpression: { status: { $in: ['completed', 'stopped', 'failed'] } }
  }
);

// ------------------------------------
// Virtuals
// ------------------------------------

TestnetVolumeSessionSchema.virtual('progress').get(function() {
  if (!this.startedAt || !this.scheduledEndAt) return 0;

  const total = this.scheduledEndAt - this.startedAt;
  const elapsed = Date.now() - this.startedAt;

  return Math.min(100, Math.round((elapsed / total) * 100));
});

TestnetVolumeSessionSchema.virtual('timeRemaining').get(function() {
  if (!this.scheduledEndAt) return 0;
  return Math.max(0, this.scheduledEndAt - Date.now());
});

TestnetVolumeSessionSchema.virtual('isActive').get(function() {
  return this.status === 'running';
});

TestnetVolumeSessionSchema.virtual('duration').get(function() {
  if (!this.startedAt) return 0;
  const endTime = this.completedAt || new Date();
  return endTime - this.startedAt;
});

// ------------------------------------
// Methods
// ------------------------------------

/**
 * Start the session
 */
TestnetVolumeSessionSchema.methods.start = async function() {
  this.status = 'running';
  this.startedAt = new Date();
  this.scheduledEndAt = new Date(Date.now() + this.config.duration * 60 * 1000);

  return this.save();
};

/**
 * Pause the session
 */
TestnetVolumeSessionSchema.methods.pause = async function() {
  this.status = 'paused';
  this.pausedAt = new Date();

  return this.save();
};

/**
 * Resume the session
 */
TestnetVolumeSessionSchema.methods.resume = async function() {
  if (this.pausedAt) {
    const pausedDuration = Date.now() - this.pausedAt;
    this.scheduledEndAt = new Date(this.scheduledEndAt.getTime() + pausedDuration);
  }

  this.status = 'running';
  this.pausedAt = null;

  return this.save();
};

/**
 * Stop the session
 */
TestnetVolumeSessionSchema.methods.stop = async function() {
  this.status = 'stopped';
  this.completedAt = new Date();

  await this.calculateFinalMetrics();

  return this.save();
};

/**
 * Complete the session
 */
TestnetVolumeSessionSchema.methods.complete = async function() {
  this.status = 'completed';
  this.completedAt = new Date();

  await this.calculateFinalMetrics();

  return this.save();
};

/**
 * Fail the session
 */
TestnetVolumeSessionSchema.methods.fail = async function(error) {
  this.status = 'failed';
  this.completedAt = new Date();

  this.errors.push({
    timestamp: new Date(),
    error: error.message || error,
    context: 'session_failure'
  });

  return this.save();
};

/**
 * Record a trade
 */
TestnetVolumeSessionSchema.methods.recordTrade = function(trade) {
  // Add to trades log (keep last 500)
  this.trades.push({
    tradeId: trade._id,
    timestamp: new Date(),
    type: trade.type,
    wallet: trade.wallet,
    solAmount: trade.solAmount,
    tokenAmount: trade.tokenAmount,
    price: trade.price
  });

  if (this.trades.length > 500) {
    this.trades = this.trades.slice(-500);
  }

  // Update metrics
  this.metrics.totalVolume += trade.solAmount;
  this.metrics.totalTrades += 1;
  this.metrics.totalSpent += trade.solAmount;
  this.metrics.totalFees += trade.fees?.totalFee || 0;

  if (trade.type === 'buy') {
    this.metrics.buyTrades += 1;
  } else {
    this.metrics.sellTrades += 1;
  }

  // Track max price
  if (trade.price > this.metrics.maxPriceReached) {
    this.metrics.maxPriceReached = trade.price;
  }

  return this;
};

/**
 * Record an error
 */
TestnetVolumeSessionSchema.methods.recordError = function(error, context = '') {
  this.errors.push({
    timestamp: new Date(),
    error: error.message || error,
    context
  });

  // Keep only last 100 errors
  if (this.errors.length > 100) {
    this.errors = this.errors.slice(-100);
  }

  return this;
};

/**
 * Calculate final metrics
 */
TestnetVolumeSessionSchema.methods.calculateFinalMetrics = async function() {
  const durationMinutes = (Date.now() - this.startedAt.getTime()) / (1000 * 60);

  if (durationMinutes > 0) {
    this.metrics.tradesPerMinute = this.metrics.totalTrades / durationMinutes;
    this.metrics.volumePerMinute = this.metrics.totalVolume / durationMinutes;
  }

  if (this.metrics.totalTrades > 0) {
    this.metrics.averageTradeSize = this.metrics.totalSpent / this.metrics.totalTrades;
  }

  if (this.config.budget > 0) {
    this.metrics.volumeMultiplier = this.metrics.totalVolume / this.config.budget;
  }

  if (this.metrics.totalSpent > 0) {
    this.metrics.feePercentage = (this.metrics.totalFees / this.metrics.totalSpent) * 100;
  }

  if (this.metrics.startPrice > 0) {
    this.metrics.priceChange = ((this.metrics.endPrice - this.metrics.startPrice) /
      this.metrics.startPrice) * 100;
  }

  return this;
};

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Get sessions for creator
 */
TestnetVolumeSessionSchema.statics.getByCreator = async function(creator, options = {}) {
  const { page = 1, limit = 20, status = null } = options;
  const skip = (page - 1) * limit;

  const query = { creator };
  if (status) query.status = status;

  const [sessions, total] = await Promise.all([
    this.find(query)
      .select('-trades -generatedWallets')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    sessions,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get sessions for token
 */
TestnetVolumeSessionSchema.statics.getByToken = async function(tokenMint, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = { tokenMint };

  const [sessions, total] = await Promise.all([
    this.find(query)
      .select('-trades -generatedWallets')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    sessions,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get active session for creator
 */
TestnetVolumeSessionSchema.statics.getActiveSession = async function(creator) {
  return this.findOne({
    creator,
    status: { $in: ['pending', 'running', 'paused'] }
  });
};

/**
 * Check if creator has active session
 */
TestnetVolumeSessionSchema.statics.hasActiveSession = async function(creator) {
  const count = await this.countDocuments({
    creator,
    status: { $in: ['pending', 'running', 'paused'] }
  });
  return count > 0;
};

/**
 * Get all running sessions
 */
TestnetVolumeSessionSchema.statics.getRunning = async function() {
  return this.find({ status: 'running' });
};

/**
 * Get creator stats
 */
TestnetVolumeSessionSchema.statics.getCreatorStats = async function(creator) {
  const [stats] = await this.aggregate([
    { $match: { creator } },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        completedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        totalVolume: { $sum: '$metrics.totalVolume' },
        totalTrades: { $sum: '$metrics.totalTrades' },
        totalSpent: { $sum: '$metrics.totalSpent' },
        avgVolumeMultiplier: { $avg: '$metrics.volumeMultiplier' }
      }
    }
  ]);

  return stats || {
    totalSessions: 0,
    completedSessions: 0,
    totalVolume: 0,
    totalTrades: 0,
    totalSpent: 0,
    avgVolumeMultiplier: 0
  };
};

// ------------------------------------
// Export Model
// ------------------------------------

const TestnetVolumeSession = mongoose.model('TestnetVolumeSession', TestnetVolumeSessionSchema);

export default TestnetVolumeSession;
export { TestnetVolumeSessionSchema };
