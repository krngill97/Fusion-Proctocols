// ===========================================
// Fusion - Hot Wallet Model
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// Hot Wallet Schema
// ------------------------------------

const HotWalletSchema = new Schema({
  address: {
    type: String,
    required: [true, 'Wallet address is required'],
    unique: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
      },
      message: 'Invalid Solana wallet address'
    }
  },
  
  exchange: {
    type: String,
    required: [true, 'Exchange name is required'],
    lowercase: true,
    trim: true,
    index: true,
    enum: {
      values: [
        'binance',
        'crypto.com',
        'kucoin',
        'kraken',
        'okx',
        'bybit',
        'gate.io',
        'coinbase',
        'htx',
        'bitget',
        'mexc',
        'bitfinex',
        'gemini',
        'bitstamp',
        'other'
      ],
      message: 'Unknown exchange: {VALUE}'
    }
  },
  
  label: {
    type: String,
    default: function() {
      return `${this.exchange} Hot Wallet`;
    },
    maxlength: 100,
    trim: true
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Subscription ID from Chainstack WebSocket
  subscriptionId: {
    type: Number,
    default: null
  },
  
  // Statistics
  stats: {
    totalTransfers: {
      type: Number,
      default: 0
    },
    totalSolTransferred: {
      type: Number,
      default: 0
    },
    uniqueDestinations: {
      type: Number,
      default: 0
    },
    lastTransferAt: {
      type: Date,
      default: null
    },
    lastTransferAmount: {
      type: Number,
      default: 0
    },
    lastTransferTo: {
      type: String,
      default: null
    },
    avgTransferAmount: {
      type: Number,
      default: 0
    },
    // Track transfers per hour for rate analysis
    transfersLastHour: {
      type: Number,
      default: 0
    },
    lastHourReset: {
      type: Date,
      default: Date.now
    }
  },
  
  // Tracking metadata
  tracking: {
    startedAt: {
      type: Date,
      default: null
    },
    pausedAt: {
      type: Date,
      default: null
    },
    totalUptime: {
      type: Number,
      default: 0 // in seconds
    }
  },
  
  // Notes for manual tracking
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

HotWalletSchema.index({ exchange: 1, isActive: 1 });
HotWalletSchema.index({ 'stats.lastTransferAt': -1 });
HotWalletSchema.index({ createdAt: -1 });

// ------------------------------------
// Virtuals
// ------------------------------------

HotWalletSchema.virtual('isTracking').get(function() {
  return this.isActive && this.subscriptionId !== null;
});

HotWalletSchema.virtual('shortAddress').get(function() {
  return `${this.address.slice(0, 4)}...${this.address.slice(-4)}`;
});

HotWalletSchema.virtual('transferRate').get(function() {
  // Transfers per hour
  if (!this.stats.lastHourReset) return 0;
  
  const hoursPassed = (Date.now() - this.stats.lastHourReset) / (1000 * 60 * 60);
  if (hoursPassed < 0.1) return 0; // Less than 6 minutes
  
  return (this.stats.transfersLastHour / hoursPassed).toFixed(2);
});

// ------------------------------------
// Methods
// ------------------------------------

/**
 * Record a transfer from this hot wallet
 */
HotWalletSchema.methods.recordTransfer = async function(toAddress, amount, signature) {
  const now = new Date();
  
  // Reset hourly counter if needed
  const hourAgo = new Date(now - 60 * 60 * 1000);
  if (this.stats.lastHourReset < hourAgo) {
    this.stats.transfersLastHour = 0;
    this.stats.lastHourReset = now;
  }
  
  // Update stats
  this.stats.totalTransfers += 1;
  this.stats.totalSolTransferred += amount;
  this.stats.lastTransferAt = now;
  this.stats.lastTransferAmount = amount;
  this.stats.lastTransferTo = toAddress;
  this.stats.transfersLastHour += 1;
  
  // Calculate new average
  this.stats.avgTransferAmount = 
    this.stats.totalSolTransferred / this.stats.totalTransfers;
  
  return this.save();
};

/**
 * Start tracking this wallet
 */
HotWalletSchema.methods.startTracking = async function(subscriptionId) {
  this.subscriptionId = subscriptionId;
  this.isActive = true;
  this.tracking.startedAt = new Date();
  this.tracking.pausedAt = null;
  
  return this.save();
};

/**
 * Stop tracking this wallet
 */
HotWalletSchema.methods.stopTracking = async function() {
  // Calculate uptime
  if (this.tracking.startedAt && !this.tracking.pausedAt) {
    const uptime = (Date.now() - this.tracking.startedAt) / 1000;
    this.tracking.totalUptime += uptime;
  }
  
  this.subscriptionId = null;
  this.tracking.pausedAt = new Date();
  
  return this.save();
};

/**
 * Increment unique destinations count
 */
HotWalletSchema.methods.incrementUniqueDestinations = async function() {
  this.stats.uniqueDestinations += 1;
  return this.save();
};

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Get all active hot wallets
 */
HotWalletSchema.statics.getActive = async function() {
  return this.find({ isActive: true }).sort({ exchange: 1 });
};

/**
 * Get hot wallets by exchange
 */
HotWalletSchema.statics.getByExchange = async function(exchange) {
  return this.find({ exchange: exchange.toLowerCase(), isActive: true });
};

/**
 * Get hot wallets currently being tracked
 */
HotWalletSchema.statics.getTracking = async function() {
  return this.find({ 
    isActive: true, 
    subscriptionId: { $ne: null } 
  });
};

/**
 * Bulk add hot wallets
 */
HotWalletSchema.statics.bulkAdd = async function(wallets) {
  const operations = wallets.map(wallet => ({
    updateOne: {
      filter: { address: wallet.address },
      update: { $setOnInsert: wallet },
      upsert: true
    }
  }));
  
  return this.bulkWrite(operations);
};

/**
 * Get stats summary across all hot wallets
 */
HotWalletSchema.statics.getStatsSummary = async function() {
  const result = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalWallets: { $sum: 1 },
        totalTransfers: { $sum: '$stats.totalTransfers' },
        totalSolTransferred: { $sum: '$stats.totalSolTransferred' },
        avgTransferAmount: { $avg: '$stats.avgTransferAmount' },
        uniqueDestinations: { $sum: '$stats.uniqueDestinations' }
      }
    }
  ]);
  
  return result[0] || {
    totalWallets: 0,
    totalTransfers: 0,
    totalSolTransferred: 0,
    avgTransferAmount: 0,
    uniqueDestinations: 0
  };
};

/**
 * Get top hot wallets by transfer count
 */
HotWalletSchema.statics.getTopByTransfers = async function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ 'stats.totalTransfers': -1 })
    .limit(limit);
};

// ------------------------------------
// Pre-save Hooks
// ------------------------------------

HotWalletSchema.pre('save', function(next) {
  // Auto-generate label if not provided
  if (!this.label) {
    this.label = `${this.exchange.charAt(0).toUpperCase() + this.exchange.slice(1)} Hot Wallet`;
  }
  next();
});

// ------------------------------------
// Export Model
// ------------------------------------

const HotWallet = mongoose.model('HotWallet', HotWalletSchema);

export default HotWallet;
export { HotWalletSchema };
