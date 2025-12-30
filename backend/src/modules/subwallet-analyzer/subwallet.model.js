// ===========================================
// Fusion - Subwallet Model
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// Token Purchase Sub-Schema
// ------------------------------------

const TokenPurchaseSchema = new Schema({
  mint: {
    type: String,
    required: true,
    index: true
  },
  symbol: {
    type: String,
    default: 'UNKNOWN'
  },
  amount: {
    type: Number,
    required: true
  },
  solSpent: {
    type: Number,
    required: true
  },
  pricePerToken: {
    type: Number,
    default: 0
  },
  dex: {
    type: String,
    enum: ['jupiter', 'raydium', 'pump.fun', 'unknown'],
    default: 'unknown'
  },
  txSignature: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// ------------------------------------
// Pool Creation Sub-Schema
// ------------------------------------

const PoolCreationSchema = new Schema({
  poolAddress: {
    type: String,
    required: true
  },
  tokenMint: {
    type: String,
    required: true
  },
  tokenSymbol: {
    type: String,
    default: 'UNKNOWN'
  },
  platform: {
    type: String,
    enum: ['raydium', 'orca', 'meteora', 'unknown'],
    default: 'raydium'
  },
  initialLiquidity: {
    type: Number,
    default: 0
  },
  txSignature: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// ------------------------------------
// Minted Token Sub-Schema
// ------------------------------------

const MintedTokenSchema = new Schema({
  mint: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    default: 'Unknown Token'
  },
  symbol: {
    type: String,
    default: 'UNKNOWN'
  },
  decimals: {
    type: Number,
    default: 9
  },
  supply: {
    type: String,
    default: '0'
  },
  platform: {
    type: String,
    enum: ['pump.fun', 'standard', 'unknown'],
    default: 'unknown'
  },
  txSignature: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Additional metadata
  metadata: {
    uri: String,
    image: String,
    description: String
  }
}, { _id: true });

// ------------------------------------
// Main Subwallet Schema
// ------------------------------------

const SubwalletSchema = new Schema({
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
  
  // Reference to the hot wallet that sent SOL here
  sourceHotWallet: {
    type: Schema.Types.ObjectId,
    ref: 'HotWallet',
    required: true,
    index: true
  },
  
  // Initial transfer details
  initialTransfer: {
    amount: {
      type: Number,
      required: true
    },
    txSignature: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  
  // Current status
  status: {
    type: String,
    enum: ['watching', 'active', 'inactive', 'archived'],
    default: 'watching',
    index: true
  },
  
  // Activity detection flags
  activity: {
    // Token minting
    hasMinted: {
      type: Boolean,
      default: false,
      index: true
    },
    mintedTokens: [MintedTokenSchema],
    
    // Pool creation
    hasCreatedPool: {
      type: Boolean,
      default: false,
      index: true
    },
    createdPools: [PoolCreationSchema],
    
    // Token purchases
    hasBoughtToken: {
      type: Boolean,
      default: false,
      index: true
    },
    tokenPurchases: [TokenPurchaseSchema],
    
    // General activity
    transactionCount: {
      type: Number,
      default: 0
    },
    lastActivityAt: {
      type: Date,
      default: null
    }
  },
  
  // Current balances (cached)
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
  
  // Tracking settings
  watchUntil: {
    type: Date,
    required: true,
    index: true
  },
  
  // WebSocket subscription ID
  subscriptionId: {
    type: Number,
    default: null
  },
  
  // Signal sent flags (to avoid duplicate notifications)
  signalsSent: {
    mint: {
      type: Boolean,
      default: false
    },
    pool: {
      type: Boolean,
      default: false
    },
    buy: {
      type: Boolean,
      default: false
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

// Compound indexes for common queries
SubwalletSchema.index({ sourceHotWallet: 1, status: 1 });
SubwalletSchema.index({ status: 1, watchUntil: 1 });
SubwalletSchema.index({ 'activity.hasMinted': 1, createdAt: -1 });
SubwalletSchema.index({ 'activity.hasCreatedPool': 1, createdAt: -1 });
SubwalletSchema.index({ 'activity.hasBoughtToken': 1, createdAt: -1 });
SubwalletSchema.index({ createdAt: -1 });

// TTL index - auto-delete archived subwallets after 30 days
SubwalletSchema.index(
  { updatedAt: 1 }, 
  { 
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { status: 'archived' }
  }
);

// ------------------------------------
// Virtuals
// ------------------------------------

SubwalletSchema.virtual('shortAddress').get(function() {
  return `${this.address.slice(0, 4)}...${this.address.slice(-4)}`;
});

SubwalletSchema.virtual('isExpired').get(function() {
  return new Date() > this.watchUntil;
});

SubwalletSchema.virtual('hasAnyActivity').get(function() {
  return this.activity.hasMinted || 
         this.activity.hasCreatedPool || 
         this.activity.hasBoughtToken;
});

SubwalletSchema.virtual('activitySummary').get(function() {
  const activities = [];
  if (this.activity.hasMinted) activities.push('minted');
  if (this.activity.hasCreatedPool) activities.push('pool');
  if (this.activity.hasBoughtToken) activities.push('bought');
  return activities;
});

SubwalletSchema.virtual('watchTimeRemaining').get(function() {
  const remaining = this.watchUntil - new Date();
  return Math.max(0, remaining);
});

// ------------------------------------
// Methods
// ------------------------------------

/**
 * Record a token mint
 */
SubwalletSchema.methods.recordMint = async function(mintData) {
  this.activity.hasMinted = true;
  this.activity.mintedTokens.push(mintData);
  this.activity.lastActivityAt = new Date();
  this.activity.transactionCount += 1;
  this.status = 'active';
  
  return this.save();
};

/**
 * Record a pool creation
 */
SubwalletSchema.methods.recordPoolCreation = async function(poolData) {
  this.activity.hasCreatedPool = true;
  this.activity.createdPools.push(poolData);
  this.activity.lastActivityAt = new Date();
  this.activity.transactionCount += 1;
  this.status = 'active';
  
  return this.save();
};

/**
 * Record a token purchase
 */
SubwalletSchema.methods.recordTokenPurchase = async function(purchaseData) {
  this.activity.hasBoughtToken = true;
  this.activity.tokenPurchases.push(purchaseData);
  this.activity.lastActivityAt = new Date();
  this.activity.transactionCount += 1;
  this.status = 'active';
  
  return this.save();
};

/**
 * Update SOL balance
 */
SubwalletSchema.methods.updateBalance = async function(solBalance) {
  this.balances.sol = solBalance;
  this.balances.lastUpdated = new Date();
  return this.save();
};

/**
 * Mark signal as sent
 */
SubwalletSchema.methods.markSignalSent = async function(signalType) {
  if (this.signalsSent.hasOwnProperty(signalType)) {
    this.signalsSent[signalType] = true;
    return this.save();
  }
};

/**
 * Archive the subwallet
 */
SubwalletSchema.methods.archive = async function() {
  this.status = 'archived';
  this.subscriptionId = null;
  return this.save();
};

/**
 * Extend watch time
 */
SubwalletSchema.methods.extendWatchTime = async function(hours = 24) {
  this.watchUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Find or create subwallet
 */
SubwalletSchema.statics.findOrCreate = async function(address, hotWalletId, transferData) {
  let subwallet = await this.findOne({ address });
  
  if (!subwallet) {
    const watchHours = parseInt(process.env.SUBWALLET_WATCH_HOURS) || 24;
    
    subwallet = await this.create({
      address,
      sourceHotWallet: hotWalletId,
      initialTransfer: {
        amount: transferData.amount,
        txSignature: transferData.signature,
        timestamp: transferData.timestamp || new Date()
      },
      watchUntil: new Date(Date.now() + watchHours * 60 * 60 * 1000)
    });
  }
  
  return subwallet;
};

/**
 * Get active subwallets that need watching
 */
SubwalletSchema.statics.getWatching = async function() {
  return this.find({
    status: 'watching',
    watchUntil: { $gt: new Date() }
  }).populate('sourceHotWallet', 'address exchange label');
};

/**
 * Get subwallets with activity
 */
SubwalletSchema.statics.getActive = async function() {
  return this.find({
    status: 'active'
  })
  .populate('sourceHotWallet', 'address exchange label')
  .sort({ 'activity.lastActivityAt': -1 });
};

/**
 * Get expired subwallets for archiving
 */
SubwalletSchema.statics.getExpired = async function() {
  return this.find({
    status: 'watching',
    watchUntil: { $lte: new Date() }
  });
};

/**
 * Archive expired subwallets without activity
 */
SubwalletSchema.statics.archiveExpired = async function() {
  const result = await this.updateMany(
    {
      status: 'watching',
      watchUntil: { $lte: new Date() },
      'activity.hasMinted': false,
      'activity.hasCreatedPool': false,
      'activity.hasBoughtToken': false
    },
    {
      $set: { status: 'archived', subscriptionId: null }
    }
  );
  
  return result.modifiedCount;
};

/**
 * Get subwallets by hot wallet
 */
SubwalletSchema.statics.getByHotWallet = async function(hotWalletId, options = {}) {
  const query = { sourceHotWallet: hotWalletId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

/**
 * Get recent mints
 */
SubwalletSchema.statics.getRecentMints = async function(limit = 20) {
  return this.find({
    'activity.hasMinted': true
  })
  .sort({ 'activity.mintedTokens.timestamp': -1 })
  .limit(limit)
  .populate('sourceHotWallet', 'address exchange label');
};

/**
 * Get stats summary
 */
SubwalletSchema.statics.getStatsSummary = async function() {
  const [stats] = await this.aggregate([
    {
      $group: {
        _id: null,
        totalSubwallets: { $sum: 1 },
        watching: {
          $sum: { $cond: [{ $eq: ['$status', 'watching'] }, 1, 0] }
        },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        archived: {
          $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] }
        },
        withMints: {
          $sum: { $cond: ['$activity.hasMinted', 1, 0] }
        },
        withPools: {
          $sum: { $cond: ['$activity.hasCreatedPool', 1, 0] }
        },
        withBuys: {
          $sum: { $cond: ['$activity.hasBoughtToken', 1, 0] }
        },
        totalSolReceived: { $sum: '$initialTransfer.amount' }
      }
    }
  ]);
  
  return stats || {
    totalSubwallets: 0,
    watching: 0,
    active: 0,
    archived: 0,
    withMints: 0,
    withPools: 0,
    withBuys: 0,
    totalSolReceived: 0
  };
};

// ------------------------------------
// Export Model
// ------------------------------------

const Subwallet = mongoose.model('Subwallet', SubwalletSchema);

export default Subwallet;
export { SubwalletSchema };
