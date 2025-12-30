// ===========================================
// Fusion - Transfer Log Model
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// Transfer Log Schema
// ------------------------------------

const TransferLogSchema = new Schema({
  // Transfer details
  fromWallet: {
    type: String,
    required: true,
    index: true
  },
  toWallet: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true // in SOL
  },
  
  // Transaction info
  txSignature: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  slot: {
    type: Number,
    default: null
  },
  blockTime: {
    type: Date,
    default: null
  },
  
  // Source classification
  source: {
    type: String,
    enum: ['hot_wallet', 'subwallet', 'user_tracked', 'volume_bot', 'unknown'],
    required: true,
    index: true
  },
  
  // Related entities
  relatedHotWallet: {
    type: Schema.Types.ObjectId,
    ref: 'HotWallet',
    default: null,
    index: true
  },
  relatedSubwallet: {
    type: Schema.Types.ObjectId,
    ref: 'Subwallet',
    default: null
  },
  relatedUserWallet: {
    type: Schema.Types.ObjectId,
    ref: 'UserWallet',
    default: null
  },
  
  // Additional context
  context: {
    exchange: String,
    label: String,
    isInitialFunding: Boolean,
    notes: String
  },
  
  // TTL field for auto-deletion
  expireAt: {
    type: Date,
    required: true,
    index: true
  }
  
}, {
  timestamps: true
});

// ------------------------------------
// Indexes
// ------------------------------------

// Compound indexes for common queries
TransferLogSchema.index({ source: 1, createdAt: -1 });
TransferLogSchema.index({ fromWallet: 1, createdAt: -1 });
TransferLogSchema.index({ toWallet: 1, createdAt: -1 });
TransferLogSchema.index({ relatedHotWallet: 1, createdAt: -1 });
TransferLogSchema.index({ blockTime: -1 });

// TTL index - auto-delete after expireAt date
TransferLogSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Create transfer log with 30-day expiry
 */
TransferLogSchema.statics.createLog = async function(data) {
  const expireAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  return this.create({
    ...data,
    expireAt
  });
};

/**
 * Get transfers from a wallet
 */
TransferLogSchema.statics.getFromWallet = async function(address, options = {}) {
  const query = { fromWallet: address };
  
  if (options.startDate) {
    query.createdAt = { $gte: options.startDate };
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 100)
    .lean();
};

/**
 * Get transfers to a wallet
 */
TransferLogSchema.statics.getToWallet = async function(address, options = {}) {
  const query = { toWallet: address };
  
  if (options.startDate) {
    query.createdAt = { $gte: options.startDate };
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 100)
    .lean();
};

/**
 * Get transfers by hot wallet
 */
TransferLogSchema.statics.getByHotWallet = async function(hotWalletId, options = {}) {
  return this.find({ relatedHotWallet: hotWalletId })
    .sort({ createdAt: -1 })
    .limit(options.limit || 100)
    .lean();
};

/**
 * Get transfer by signature
 */
TransferLogSchema.statics.getBySignature = async function(signature) {
  return this.findOne({ txSignature: signature });
};

/**
 * Check if transfer already logged
 */
TransferLogSchema.statics.exists = async function(signature) {
  const count = await this.countDocuments({ txSignature: signature });
  return count > 0;
};

/**
 * Get recent transfers summary
 */
TransferLogSchema.statics.getRecentSummary = async function(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const [summary] = await this.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        totalTransfers: { $sum: 1 },
        totalVolume: { $sum: '$amount' },
        uniqueFromWallets: { $addToSet: '$fromWallet' },
        uniqueToWallets: { $addToSet: '$toWallet' },
        bySource: {
          $push: '$source'
        }
      }
    },
    {
      $project: {
        totalTransfers: 1,
        totalVolume: 1,
        uniqueFromWalletsCount: { $size: '$uniqueFromWallets' },
        uniqueToWalletsCount: { $size: '$uniqueToWallets' }
      }
    }
  ]);
  
  return summary || {
    totalTransfers: 0,
    totalVolume: 0,
    uniqueFromWalletsCount: 0,
    uniqueToWalletsCount: 0
  };
};

/**
 * Get hourly transfer stats
 */
TransferLogSchema.statics.getHourlyStats = async function(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' }
        },
        count: { $sum: 1 },
        volume: { $sum: '$amount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// ------------------------------------
// Export Model
// ------------------------------------

const TransferLog = mongoose.model('TransferLog', TransferLogSchema);

export default TransferLog;
export { TransferLogSchema };
