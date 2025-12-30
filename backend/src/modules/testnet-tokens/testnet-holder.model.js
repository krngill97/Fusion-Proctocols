// ===========================================
// Fusion - Testnet Holder Model
// Tracks token holders and their positions
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// Main Testnet Holder Schema
// ------------------------------------

const TestnetHolderSchema = new Schema({
  // Token Reference
  tokenMint: {
    type: String,
    required: true,
    index: true
  },

  // Holder Wallet
  wallet: {
    type: String,
    required: true,
    index: true
  },

  // Balance
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  // Trading Stats
  totalBought: {
    type: Number,
    default: 0 // Total tokens bought
  },
  totalSold: {
    type: Number,
    default: 0 // Total tokens sold
  },
  totalInvested: {
    type: Number,
    default: 0 // Total SOL spent
  },
  totalReturned: {
    type: Number,
    default: 0 // Total SOL received from sells
  },

  // P&L Tracking
  realizedPnL: {
    type: Number,
    default: 0 // Realized profit/loss in SOL
  },
  unrealizedPnL: {
    type: Number,
    default: 0 // Unrealized profit/loss in SOL
  },

  // Timing
  firstBuyAt: {
    type: Date,
    default: null
  },
  lastTradeAt: {
    type: Date,
    default: null
  },

  // Trade Count
  tradeCount: {
    type: Number,
    default: 0
  },

  // Average Prices
  averageBuyPrice: {
    type: Number,
    default: 0
  },
  averageSellPrice: {
    type: Number,
    default: 0
  },

  // Status
  isActive: {
    type: Boolean,
    default: false, // True if balance > 0
    index: true
  },

  // Volume bot flag
  isVolumeBot: {
    type: Boolean,
    default: false,
    index: true
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

// Compound unique index
TestnetHolderSchema.index({ tokenMint: 1, wallet: 1 }, { unique: true });
TestnetHolderSchema.index({ tokenMint: 1, balance: -1 });
TestnetHolderSchema.index({ tokenMint: 1, isActive: 1 });
TestnetHolderSchema.index({ wallet: 1, isActive: 1 });

// ------------------------------------
// Virtuals
// ------------------------------------

TestnetHolderSchema.virtual('totalPnL').get(function() {
  return this.realizedPnL + this.unrealizedPnL;
});

TestnetHolderSchema.virtual('percentageHeld').get(function() {
  // This would need token totalSupply to calculate
  return 0;
});

TestnetHolderSchema.virtual('roi').get(function() {
  if (this.totalInvested === 0) return 0;
  return ((this.totalReturned + this.unrealizedPnL - this.totalInvested) / this.totalInvested) * 100;
});

// ------------------------------------
// Methods
// ------------------------------------

/**
 * Process a buy trade
 */
TestnetHolderSchema.methods.processBuy = function(tokenAmount, solAmount, price) {
  // Update balance and stats
  this.balance += tokenAmount;
  this.totalBought += tokenAmount;
  this.totalInvested += solAmount;
  this.tradeCount += 1;

  // Update average buy price (weighted)
  if (this.totalBought > 0) {
    this.averageBuyPrice = this.totalInvested / this.totalBought;
  }

  // Set first buy time
  if (!this.firstBuyAt) {
    this.firstBuyAt = new Date();
  }

  this.lastTradeAt = new Date();
  this.isActive = this.balance > 0;

  return this;
};

/**
 * Process a sell trade
 */
TestnetHolderSchema.methods.processSell = function(tokenAmount, solAmount, price) {
  // Update balance and stats
  this.balance -= tokenAmount;
  this.totalSold += tokenAmount;
  this.totalReturned += solAmount;
  this.tradeCount += 1;

  // Calculate realized P&L
  const costBasis = tokenAmount * this.averageBuyPrice;
  this.realizedPnL += (solAmount - costBasis);

  // Update average sell price
  if (this.totalSold > 0) {
    this.averageSellPrice = this.totalReturned / this.totalSold;
  }

  this.lastTradeAt = new Date();
  this.isActive = this.balance > 0;

  return this;
};

/**
 * Update unrealized P&L based on current price
 */
TestnetHolderSchema.methods.updateUnrealizedPnL = function(currentPrice) {
  if (this.balance > 0) {
    const currentValue = this.balance * currentPrice;
    const costBasis = this.balance * this.averageBuyPrice;
    this.unrealizedPnL = currentValue - costBasis;
  } else {
    this.unrealizedPnL = 0;
  }

  return this;
};

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Get or create holder
 */
TestnetHolderSchema.statics.getOrCreate = async function(tokenMint, wallet) {
  let holder = await this.findOne({ tokenMint, wallet });

  if (!holder) {
    holder = new this({
      tokenMint,
      wallet,
      balance: 0,
      isActive: false
    });
  }

  return holder;
};

/**
 * Get holders for a token
 */
TestnetHolderSchema.statics.getByToken = async function(tokenMint, options = {}) {
  const { page = 1, limit = 50, activeOnly = true, sortBy = 'balance' } = options;
  const skip = (page - 1) * limit;

  const query = { tokenMint };
  if (activeOnly) query.isActive = true;

  const sortOptions = {};
  sortOptions[sortBy] = -1;

  const [holders, total] = await Promise.all([
    this.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    holders,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get top holders for a token
 */
TestnetHolderSchema.statics.getTopHolders = async function(tokenMint, limit = 10) {
  return this.find({ tokenMint, isActive: true })
    .sort({ balance: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get active holder count for a token
 */
TestnetHolderSchema.statics.getActiveCount = async function(tokenMint) {
  return this.countDocuments({ tokenMint, isActive: true });
};

/**
 * Get holder distribution for a token
 */
TestnetHolderSchema.statics.getDistribution = async function(tokenMint) {
  const holders = await this.find({ tokenMint, isActive: true })
    .sort({ balance: -1 })
    .lean();

  if (holders.length === 0) {
    return { holders: [], distribution: {} };
  }

  const totalBalance = holders.reduce((sum, h) => sum + h.balance, 0);

  const distribution = {
    top10Percentage: 0,
    top20Percentage: 0,
    top50Percentage: 0
  };

  let cumulative = 0;
  holders.forEach((holder, index) => {
    const percentage = (holder.balance / totalBalance) * 100;
    holder.percentage = percentage;
    cumulative += holder.balance;

    if (index < 10) {
      distribution.top10Percentage = (cumulative / totalBalance) * 100;
    }
    if (index < 20) {
      distribution.top20Percentage = (cumulative / totalBalance) * 100;
    }
    if (index < 50) {
      distribution.top50Percentage = (cumulative / totalBalance) * 100;
    }
  });

  return { holders, distribution };
};

/**
 * Get holdings for a wallet
 */
TestnetHolderSchema.statics.getByWallet = async function(wallet, options = {}) {
  const { page = 1, limit = 50, activeOnly = true } = options;
  const skip = (page - 1) * limit;

  const query = { wallet };
  if (activeOnly) query.isActive = true;

  const [holdings, total] = await Promise.all([
    this.find(query)
      .sort({ balance: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    holdings,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get wallet stats across all tokens
 */
TestnetHolderSchema.statics.getWalletStats = async function(wallet) {
  const [stats] = await this.aggregate([
    { $match: { wallet } },
    {
      $group: {
        _id: null,
        totalTokensHeld: { $sum: 1 },
        activePositions: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        totalInvested: { $sum: '$totalInvested' },
        totalReturned: { $sum: '$totalReturned' },
        totalRealizedPnL: { $sum: '$realizedPnL' },
        totalUnrealizedPnL: { $sum: '$unrealizedPnL' },
        totalTrades: { $sum: '$tradeCount' }
      }
    }
  ]);

  return stats || {
    totalTokensHeld: 0,
    activePositions: 0,
    totalInvested: 0,
    totalReturned: 0,
    totalRealizedPnL: 0,
    totalUnrealizedPnL: 0,
    totalTrades: 0
  };
};

// ------------------------------------
// Export Model
// ------------------------------------

const TestnetHolder = mongoose.model('TestnetHolder', TestnetHolderSchema);

export default TestnetHolder;
export { TestnetHolderSchema };
