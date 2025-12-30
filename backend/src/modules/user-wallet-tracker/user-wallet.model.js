// ===========================================
// Fusion - User Tracked Wallet Model
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// Signal Sub-Schema
// ------------------------------------

const SignalSchema = new Schema({
  type: {
    type: String,
    enum: ['mint', 'buy', 'sell', 'pool_created', 'pool_interaction', 'large_transfer'],
    required: true,
    index: true
  },
  tokenMint: {
    type: String,
    default: null
  },
  tokenSymbol: {
    type: String,
    default: null
  },
  amount: {
    type: Number,
    default: 0
  },
  solAmount: {
    type: Number,
    default: 0
  },
  pricePerToken: {
    type: Number,
    default: 0
  },
  txSignature: {
    type: String,
    required: true
  },
  dex: {
    type: String,
    enum: ['jupiter', 'raydium', 'pump.fun', 'orca', 'unknown'],
    default: 'unknown'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Additional context
  details: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, { _id: true });

// ------------------------------------
// Main User Wallet Schema
// ------------------------------------

const UserWalletSchema = new Schema({
  // Reference to user who added this wallet
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  address: {
    type: String,
    required: [true, 'Wallet address is required'],
    index: true,
    validate: {
      validator: function(v) {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
      },
      message: 'Invalid Solana wallet address'
    }
  },
  
  label: {
    type: String,
    default: 'Tracked Wallet',
    maxlength: 100,
    trim: true
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // WebSocket subscription ID
  subscriptionId: {
    type: Number,
    default: null
  },
  
  // Signals (activity history)
  signals: {
    type: [SignalSchema],
    default: []
  },
  
  // Statistics
  stats: {
    totalSignals: {
      type: Number,
      default: 0
    },
    mintCount: {
      type: Number,
      default: 0
    },
    buyCount: {
      type: Number,
      default: 0
    },
    sellCount: {
      type: Number,
      default: 0
    },
    poolCount: {
      type: Number,
      default: 0
    },
    lastSignalAt: {
      type: Date,
      default: null
    }
  },
  
  // Cached balance info
  balances: {
    sol: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: null
    }
  },
  
  // Notification preferences for this specific wallet
  notifications: {
    enabled: {
      type: Boolean,
      default: true
    },
    onMint: {
      type: Boolean,
      default: true
    },
    onBuy: {
      type: Boolean,
      default: true
    },
    onSell: {
      type: Boolean,
      default: true
    },
    onPool: {
      type: Boolean,
      default: true
    },
    minSolAmount: {
      type: Number,
      default: 0.1 // Minimum SOL amount to trigger notification
    }
  },
  
  // Notes
  notes: {
    type: String,
    maxlength: 500,
    default: ''
  },
  
  // Tags for organization
  tags: {
    type: [String],
    default: []
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ------------------------------------
// Indexes
// ------------------------------------

// Compound unique index - user can only track a wallet once
UserWalletSchema.index({ userId: 1, address: 1 }, { unique: true });

// Query optimization indexes
UserWalletSchema.index({ userId: 1, isActive: 1 });
UserWalletSchema.index({ 'signals.timestamp': -1 });
UserWalletSchema.index({ 'stats.lastSignalAt': -1 });
UserWalletSchema.index({ tags: 1 });

// TTL index for signals (keep last 30 days)
UserWalletSchema.index(
  { 'signals.timestamp': 1 },
  { 
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { 'signals.0': { $exists: true } }
  }
);

// ------------------------------------
// Virtuals
// ------------------------------------

UserWalletSchema.virtual('shortAddress').get(function() {
  return `${this.address.slice(0, 4)}...${this.address.slice(-4)}`;
});

UserWalletSchema.virtual('recentSignals').get(function() {
  return this.signals.slice(-10).reverse();
});

UserWalletSchema.virtual('isTracking').get(function() {
  return this.isActive && this.subscriptionId !== null;
});

// ------------------------------------
// Methods
// ------------------------------------

/**
 * Add a signal
 */
UserWalletSchema.methods.addSignal = async function(signalData) {
  // Add signal
  this.signals.push(signalData);
  
  // Keep only last 1000 signals
  if (this.signals.length > 1000) {
    this.signals = this.signals.slice(-1000);
  }
  
  // Update stats
  this.stats.totalSignals += 1;
  this.stats.lastSignalAt = new Date();
  
  switch (signalData.type) {
    case 'mint':
      this.stats.mintCount += 1;
      break;
    case 'buy':
      this.stats.buyCount += 1;
      break;
    case 'sell':
      this.stats.sellCount += 1;
      break;
    case 'pool_created':
    case 'pool_interaction':
      this.stats.poolCount += 1;
      break;
  }
  
  return this.save();
};

/**
 * Update balance
 */
UserWalletSchema.methods.updateBalance = async function(solBalance) {
  this.balances.sol = solBalance;
  this.balances.lastUpdated = new Date();
  return this.save();
};

/**
 * Start tracking
 */
UserWalletSchema.methods.startTracking = async function(subscriptionId) {
  this.subscriptionId = subscriptionId;
  this.isActive = true;
  return this.save();
};

/**
 * Stop tracking
 */
UserWalletSchema.methods.stopTracking = async function() {
  this.subscriptionId = null;
  return this.save();
};

/**
 * Check if notification should be sent
 */
UserWalletSchema.methods.shouldNotify = function(signalType, solAmount = 0) {
  if (!this.notifications.enabled) return false;
  
  // Check minimum amount
  if (solAmount < this.notifications.minSolAmount) return false;
  
  // Check signal type preference
  switch (signalType) {
    case 'mint':
      return this.notifications.onMint;
    case 'buy':
      return this.notifications.onBuy;
    case 'sell':
      return this.notifications.onSell;
    case 'pool_created':
    case 'pool_interaction':
      return this.notifications.onPool;
    default:
      return true;
  }
};

/**
 * Add tag
 */
UserWalletSchema.methods.addTag = async function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
    return this.save();
  }
  return this;
};

/**
 * Remove tag
 */
UserWalletSchema.methods.removeTag = async function(tag) {
  this.tags = this.tags.filter(t => t !== tag);
  return this.save();
};

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Get all wallets for a user
 */
UserWalletSchema.statics.getByUser = async function(userId, options = {}) {
  const query = { userId };
  
  if (typeof options.isActive === 'boolean') {
    query.isActive = options.isActive;
  }
  
  let queryBuilder = this.find(query);
  
  if (options.populate) {
    queryBuilder = queryBuilder.populate('userId', 'walletAddress');
  }
  
  return queryBuilder
    .sort({ 'stats.lastSignalAt': -1, createdAt: -1 })
    .limit(options.limit || 50);
};

/**
 * Get active wallets for tracking
 */
UserWalletSchema.statics.getActiveForTracking = async function() {
  return this.find({
    isActive: true
  }).select('address subscriptionId userId');
};

/**
 * Check if user is tracking a wallet
 */
UserWalletSchema.statics.isTrackedByUser = async function(userId, address) {
  const count = await this.countDocuments({ userId, address });
  return count > 0;
};

/**
 * Get recent signals across all user's wallets
 */
UserWalletSchema.statics.getRecentSignals = async function(userId, limit = 50) {
  const wallets = await this.find({ userId, isActive: true })
    .select('address label signals')
    .lean();
  
  // Flatten and sort signals
  const allSignals = wallets.flatMap(wallet => 
    wallet.signals.map(signal => ({
      ...signal,
      walletAddress: wallet.address,
      walletLabel: wallet.label
    }))
  );
  
  return allSignals
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
};

/**
 * Get wallets by tag
 */
UserWalletSchema.statics.getByTag = async function(userId, tag) {
  return this.find({
    userId,
    tags: tag,
    isActive: true
  }).sort({ 'stats.lastSignalAt': -1 });
};

/**
 * Get stats summary for user
 */
UserWalletSchema.statics.getUserStats = async function(userId) {
  const [stats] = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalWallets: { $sum: 1 },
        activeWallets: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        totalSignals: { $sum: '$stats.totalSignals' },
        totalMints: { $sum: '$stats.mintCount' },
        totalBuys: { $sum: '$stats.buyCount' },
        totalSells: { $sum: '$stats.sellCount' },
        totalPools: { $sum: '$stats.poolCount' }
      }
    }
  ]);
  
  return stats || {
    totalWallets: 0,
    activeWallets: 0,
    totalSignals: 0,
    totalMints: 0,
    totalBuys: 0,
    totalSells: 0,
    totalPools: 0
  };
};

/**
 * Clean old signals (keep last 30 days)
 */
UserWalletSchema.statics.cleanOldSignals = async function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const result = await this.updateMany(
    {},
    {
      $pull: {
        signals: { timestamp: { $lt: thirtyDaysAgo } }
      }
    }
  );
  
  return result.modifiedCount;
};

// ------------------------------------
// Pre-save Hooks
// ------------------------------------

UserWalletSchema.pre('save', function(next) {
  // Ensure tags are unique and lowercase
  if (this.tags) {
    this.tags = [...new Set(this.tags.map(t => t.toLowerCase().trim()))];
  }
  next();
});

// ------------------------------------
// Export Model
// ------------------------------------

const UserWallet = mongoose.model('UserWallet', UserWalletSchema);

export default UserWallet;
export { UserWalletSchema };
