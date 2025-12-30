// ===========================================
// Fusion - Volume Bot Session Model
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// Generated Wallet Sub-Schema
// ------------------------------------

const GeneratedWalletSchema = new Schema({
  publicKey: {
    type: String,
    required: true,
    index: true
  },
  encryptedPrivateKey: {
    type: String,
    required: true
  },
  solBalance: {
    type: Number,
    default: 0
  },
  tokenBalance: {
    type: Number,
    default: 0
  },
  transactionCount: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: null
  }
}, { _id: true });

// ------------------------------------
// Transaction Log Sub-Schema
// ------------------------------------

const TransactionLogSchema = new Schema({
  action: {
    type: String,
    enum: ['buy', 'sell', 'transfer_in', 'transfer_out'],
    required: true
  },
  fromWallet: {
    type: String,
    required: true
  },
  toWallet: {
    type: String,
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  tokenAmount: {
    type: Number,
    default: 0
  },
  txSignature: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending'
  },
  fee: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// ------------------------------------
// Main Volume Session Schema
// ------------------------------------

const VolumeSessionSchema = new Schema({
  // Reference to user
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Session status
  status: {
    type: String,
    enum: ['pending', 'initializing', 'running', 'active', 'paused', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Token being traded
  tokenMint: {
    type: String,
    required: true,
    index: true
  },
  tokenSymbol: {
    type: String,
    default: 'UNKNOWN'
  },
  tokenDecimals: {
    type: Number,
    default: 9
  },
  
  // Configuration
  config: {
    totalSolDeposited: {
      type: Number,
      required: true,
      min: 0.1, // Lowered for devnet testing
      max: 50
    },
    duration: {
      type: Number,
      required: true, // In minutes
      min: 5,
      max: 1440
    },
    walletCount: {
      type: Number,
      required: true,
      min: 5,
      max: 20
    },
    txFrequency: {
      type: Number,
      required: true, // Transactions per minute
      min: 1,
      max: 30
    },
    minAmount: {
      type: Number,
      required: true,
      min: 0.001
    },
    maxAmount: {
      type: Number,
      required: true,
      max: 0.5
    },
    buyRatio: {
      type: Number,
      default: 0.6, // 60% buys, 40% sells
      min: 0.3,
      max: 0.7
    },
    slippageBps: {
      type: Number,
      default: 200
    },
    priorityFee: {
      type: Number,
      default: 10000
    }
  },
  
  // Funding wallet (main wallet that funds the generated wallets)
  fundingWallet: {
    publicKey: {
      type: String,
      required: true
    },
    encryptedPrivateKey: {
      type: String,
      required: true
    }
  },
  
  // Generated wallets for volume generation
  generatedWallets: {
    type: [GeneratedWalletSchema],
    default: []
  },
  
  // Network
  network: {
    type: String,
    enum: ['devnet', 'testnet', 'mainnet-beta'],
    required: true,
    index: true
  },
  
  // Running state
  currentState: {
    solRemaining: {
      type: Number,
      default: 0
    },
    isRunning: {
      type: Boolean,
      default: false
    },
    lastTxAt: {
      type: Date,
      default: null
    },
    nextTxAt: {
      type: Date,
      default: null
    },
    currentRound: {
      type: Number,
      default: 0
    }
  },
  
  // Statistics
  stats: {
    totalTransactions: {
      type: Number,
      default: 0
    },
    successfulTransactions: {
      type: Number,
      default: 0
    },
    failedTransactions: {
      type: Number,
      default: 0
    },
    buyTransactions: {
      type: Number,
      default: 0
    },
    sellTransactions: {
      type: Number,
      default: 0
    },
    totalVolume: {
      type: Number,
      default: 0 // in SOL
    },
    tokenVolume: {
      type: Number,
      default: 0 // in tokens
    },
    holdersCreated: {
      type: Number,
      default: 0
    },
    solSpent: {
      type: Number,
      default: 0
    },
    feesSpent: {
      type: Number,
      default: 0
    },
    avgTxTime: {
      type: Number,
      default: 0 // milliseconds
    }
  },
  
  // Transaction logs (keep last 500)
  logs: {
    type: [TransactionLogSchema],
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
  
  // Error tracking
  lastError: {
    message: String,
    code: String,
    timestamp: Date
  },
  errorCount: {
    type: Number,
    default: 0
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

VolumeSessionSchema.index({ userId: 1, status: 1 });
VolumeSessionSchema.index({ userId: 1, createdAt: -1 });
VolumeSessionSchema.index({ status: 1, network: 1 });
VolumeSessionSchema.index({ scheduledEndAt: 1 }, { sparse: true });

// TTL index - delete completed sessions after 30 days
VolumeSessionSchema.index(
  { completedAt: 1 },
  { 
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { status: { $in: ['completed', 'failed', 'cancelled'] } }
  }
);

// ------------------------------------
// Virtuals
// ------------------------------------

VolumeSessionSchema.virtual('progress').get(function() {
  if (!this.startedAt || !this.scheduledEndAt) return 0;
  
  const total = this.scheduledEndAt - this.startedAt;
  const elapsed = Date.now() - this.startedAt;
  
  return Math.min(100, Math.round((elapsed / total) * 100));
});

VolumeSessionSchema.virtual('timeRemaining').get(function() {
  if (!this.scheduledEndAt) return 0;
  return Math.max(0, this.scheduledEndAt - Date.now());
});

VolumeSessionSchema.virtual('successRate').get(function() {
  if (this.stats.totalTransactions === 0) return 0;
  return ((this.stats.successfulTransactions / this.stats.totalTransactions) * 100).toFixed(2);
});

VolumeSessionSchema.virtual('avgVolumePerTx').get(function() {
  if (this.stats.successfulTransactions === 0) return 0;
  return (this.stats.totalVolume / this.stats.successfulTransactions).toFixed(4);
});

VolumeSessionSchema.virtual('isActive').get(function() {
  return this.status === 'active' && this.currentState.isRunning;
});

// ------------------------------------
// Methods
// ------------------------------------

/**
 * Initialize session with generated wallets
 */
VolumeSessionSchema.methods.initialize = async function(wallets) {
  this.generatedWallets = wallets;
  this.currentState.solRemaining = this.config.totalSolDeposited;
  this.stats.holdersCreated = wallets.length;
  
  return this.save();
};

/**
 * Start the session
 */
VolumeSessionSchema.methods.start = async function() {
  this.status = 'active';
  this.currentState.isRunning = true;
  this.startedAt = new Date();
  this.scheduledEndAt = new Date(Date.now() + this.config.duration * 60 * 1000);
  
  return this.save();
};

/**
 * Pause the session
 */
VolumeSessionSchema.methods.pause = async function() {
  this.status = 'paused';
  this.currentState.isRunning = false;
  this.pausedAt = new Date();
  
  return this.save();
};

/**
 * Resume the session
 */
VolumeSessionSchema.methods.resume = async function() {
  // Extend scheduled end time by paused duration
  const pausedDuration = Date.now() - this.pausedAt;
  this.scheduledEndAt = new Date(this.scheduledEndAt.getTime() + pausedDuration);
  
  this.status = 'active';
  this.currentState.isRunning = true;
  this.pausedAt = null;
  
  return this.save();
};

/**
 * Complete the session
 */
VolumeSessionSchema.methods.complete = async function(reason = 'duration_ended') {
  this.status = 'completed';
  this.currentState.isRunning = false;
  this.completedAt = new Date();
  this.notes = reason;
  
  return this.save();
};

/**
 * Fail the session
 */
VolumeSessionSchema.methods.fail = async function(error) {
  this.status = 'failed';
  this.currentState.isRunning = false;
  this.completedAt = new Date();
  this.lastError = {
    message: error.message || error,
    code: error.code || 'UNKNOWN',
    timestamp: new Date()
  };
  
  return this.save();
};

/**
 * Cancel the session
 */
VolumeSessionSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  this.currentState.isRunning = false;
  this.completedAt = new Date();
  
  return this.save();
};

/**
 * Record a transaction
 */
VolumeSessionSchema.methods.recordTransaction = async function(txData) {
  // Add to logs (keep last 500)
  this.logs.push(txData);
  if (this.logs.length > 500) {
    this.logs = this.logs.slice(-500);
  }
  
  // Update stats
  this.stats.totalTransactions += 1;
  
  if (txData.status === 'confirmed') {
    this.stats.successfulTransactions += 1;
    this.stats.totalVolume += txData.amount;
    this.stats.solSpent += txData.amount + txData.fee;
    this.stats.feesSpent += txData.fee;
    
    if (txData.action === 'buy') {
      this.stats.buyTransactions += 1;
      this.stats.tokenVolume += txData.tokenAmount;
    } else if (txData.action === 'sell') {
      this.stats.sellTransactions += 1;
    }
  } else {
    this.stats.failedTransactions += 1;
  }
  
  // Update state
  this.currentState.lastTxAt = new Date();
  this.currentState.solRemaining -= txData.amount + txData.fee;
  this.currentState.currentRound += 1;
  
  // Update wallet stats
  const wallet = this.generatedWallets.find(w => w.publicKey === txData.fromWallet);
  if (wallet) {
    wallet.transactionCount += 1;
    wallet.lastActivity = new Date();
    if (txData.action === 'buy') {
      wallet.tokenBalance += txData.tokenAmount;
      wallet.solBalance -= txData.amount + txData.fee;
    } else if (txData.action === 'sell') {
      wallet.tokenBalance -= txData.tokenAmount;
      wallet.solBalance += txData.amount - txData.fee;
    }
  }
  
  return this.save();
};

/**
 * Record error
 */
VolumeSessionSchema.methods.recordError = async function(error) {
  this.lastError = {
    message: error.message || error,
    code: error.code || 'UNKNOWN',
    timestamp: new Date()
  };
  this.errorCount += 1;
  
  // Auto-fail after 10 consecutive errors
  if (this.errorCount >= 10) {
    return this.fail(new Error('Too many consecutive errors'));
  }
  
  return this.save();
};

/**
 * Update wallet balances
 */
VolumeSessionSchema.methods.updateWalletBalances = async function(balances) {
  for (const [publicKey, balance] of Object.entries(balances)) {
    const wallet = this.generatedWallets.find(w => w.publicKey === publicKey);
    if (wallet) {
      wallet.solBalance = balance.sol;
      if (balance.token !== undefined) {
        wallet.tokenBalance = balance.token;
      }
    }
  }
  
  return this.save();
};

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Get sessions for user
 */
VolumeSessionSchema.statics.getByUser = async function(userId, options = {}) {
  const query = { userId };
  
  if (options.status) query.status = options.status;
  if (options.network) query.network = options.network;
  
  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;
  
  const [sessions, total] = await Promise.all([
    this.find(query)
      .select('-generatedWallets.encryptedPrivateKey -fundingWallet.encryptedPrivateKey -logs')
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
 * Get active session for user
 */
VolumeSessionSchema.statics.getActiveSession = async function(userId) {
  return this.findOne({
    userId,
    status: { $in: ['initializing', 'active', 'paused'] }
  });
};

/**
 * Check if user has active session
 */
VolumeSessionSchema.statics.hasActiveSession = async function(userId) {
  const count = await this.countDocuments({
    userId,
    status: { $in: ['initializing', 'active', 'paused'] }
  });
  return count > 0;
};

/**
 * Get all active sessions (for worker)
 */
VolumeSessionSchema.statics.getAllActive = async function() {
  return this.find({
    status: 'active',
    'currentState.isRunning': true
  });
};

/**
 * Get sessions that should be completed
 */
VolumeSessionSchema.statics.getExpiredSessions = async function() {
  return this.find({
    status: 'active',
    scheduledEndAt: { $lte: new Date() }
  });
};

/**
 * Get user stats across all sessions
 */
VolumeSessionSchema.statics.getUserStats = async function(userId) {
  const [stats] = await this.aggregate([
    { 
      $match: { 
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: ['completed', 'failed'] }
      } 
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        completedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        totalSolDeposited: { $sum: '$config.totalSolDeposited' },
        totalSolSpent: { $sum: '$stats.solSpent' },
        totalVolume: { $sum: '$stats.totalVolume' },
        totalTransactions: { $sum: '$stats.totalTransactions' },
        totalHoldersCreated: { $sum: '$stats.holdersCreated' }
      }
    }
  ]);
  
  return stats || {
    totalSessions: 0,
    completedSessions: 0,
    totalSolDeposited: 0,
    totalSolSpent: 0,
    totalVolume: 0,
    totalTransactions: 0,
    totalHoldersCreated: 0
  };
};

// ------------------------------------
// Pre-save Hooks
// ------------------------------------

VolumeSessionSchema.pre('save', function(next) {
  // Ensure minAmount <= maxAmount
  if (this.config.minAmount > this.config.maxAmount) {
    const temp = this.config.minAmount;
    this.config.minAmount = this.config.maxAmount;
    this.config.maxAmount = temp;
  }
  next();
});

// ------------------------------------
// Export Model
// ------------------------------------

const VolumeSession = mongoose.model('VolumeSession', VolumeSessionSchema);

export default VolumeSession;
export { VolumeSessionSchema };
