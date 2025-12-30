// ===========================================
// Fusion - Testnet Token Model
// Simulated Pump.fun-style tokens for testing
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// Bonding Curve Sub-Schema
// ------------------------------------

const BondingCurveSchema = new Schema({
  type: {
    type: String,
    enum: ['linear', 'exponential'],
    default: 'linear'
  },
  basePrice: {
    type: Number,
    required: true,
    default: 0.000001 // Starting price in SOL
  },
  currentPrice: {
    type: Number,
    required: true,
    default: 0.000001
  },
  maxPrice: {
    type: Number,
    required: true,
    default: 0.01 // Final price when fully sold
  },
  reserveSOL: {
    type: Number,
    default: 0 // Total SOL in virtual pool
  },
  reserveTokens: {
    type: Number,
    default: 0 // Total tokens in virtual pool
  }
}, { _id: false });

// ------------------------------------
// Token Metadata Sub-Schema
// ------------------------------------

const TokenMetadataSchema = new Schema({
  website: {
    type: String,
    maxlength: 200,
    default: ''
  },
  twitter: {
    type: String,
    maxlength: 100,
    default: ''
  },
  telegram: {
    type: String,
    maxlength: 100,
    default: ''
  },
  discord: {
    type: String,
    maxlength: 100,
    default: ''
  },
  tags: [{
    type: String,
    maxlength: 20
  }]
}, { _id: false });

// ------------------------------------
// Main Testnet Token Schema
// ------------------------------------

const TestnetTokenSchema = new Schema({
  // Token Identity
  mint: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 50,
    trim: true
  },
  symbol: {
    type: String,
    required: true,
    maxlength: 10,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  imageUrl: {
    type: String,
    maxlength: 500,
    default: ''
  },

  // Creator Info
  creator: {
    type: String,
    required: true,
    index: true
  },

  // Supply & Economics
  totalSupply: {
    type: Number,
    required: true,
    default: 1000000000
  },
  decimals: {
    type: Number,
    default: 9,
    min: 0,
    max: 9
  },
  currentSupply: {
    type: Number,
    default: 0 // Tokens sold so far
  },

  // Bonding Curve Parameters
  bondingCurve: {
    type: BondingCurveSchema,
    required: true
  },

  // Market Stats
  marketCap: {
    type: Number,
    default: 0 // Current market cap in SOL
  },
  volume24h: {
    type: Number,
    default: 0 // 24h trading volume in SOL
  },
  volumeTotal: {
    type: Number,
    default: 0 // Total trading volume in SOL
  },
  priceChange24h: {
    type: Number,
    default: 0 // Percentage change
  },

  // Activity Stats
  holders: {
    type: Number,
    default: 0
  },
  transactions: {
    type: Number,
    default: 0
  },

  // Price history for charts
  priceHistory: [{
    price: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Status
  status: {
    type: String,
    enum: ['active', 'graduated', 'inactive'],
    default: 'active',
    index: true
  },
  isLaunched: {
    type: Boolean,
    default: true
  },

  // Network
  network: {
    type: String,
    enum: ['devnet', 'testnet'],
    default: 'devnet'
  },

  // Metadata
  metadata: {
    type: TokenMetadataSchema,
    default: () => ({})
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ------------------------------------
// Indexes
// ------------------------------------

TestnetTokenSchema.index({ creator: 1, createdAt: -1 });
TestnetTokenSchema.index({ status: 1, createdAt: -1 });
TestnetTokenSchema.index({ symbol: 1 });
TestnetTokenSchema.index({ marketCap: -1 });
TestnetTokenSchema.index({ volume24h: -1 });
TestnetTokenSchema.index({ createdAt: -1 });

// Text index for search
TestnetTokenSchema.index(
  { name: 'text', symbol: 'text', description: 'text' },
  { weights: { symbol: 10, name: 5, description: 1 } }
);

// ------------------------------------
// Virtuals
// ------------------------------------

TestnetTokenSchema.virtual('soldPercentage').get(function() {
  if (this.totalSupply === 0) return 0;
  return (this.currentSupply / this.totalSupply) * 100;
});

TestnetTokenSchema.virtual('remainingTokens').get(function() {
  return this.totalSupply - this.currentSupply;
});

TestnetTokenSchema.virtual('priceIncrease').get(function() {
  if (this.bondingCurve.basePrice === 0) return 0;
  return ((this.bondingCurve.currentPrice - this.bondingCurve.basePrice) /
    this.bondingCurve.basePrice) * 100;
});

// ------------------------------------
// Methods
// ------------------------------------

/**
 * Calculate price for a given amount of tokens
 */
TestnetTokenSchema.methods.calculateBuyPrice = function(tokenAmount) {
  const { basePrice, maxPrice, reserveTokens } = this.bondingCurve;
  const totalSupply = this.totalSupply;

  // Linear bonding curve
  const currentProgress = (totalSupply - reserveTokens) / totalSupply;
  const priceRange = maxPrice - basePrice;
  const startPrice = basePrice + (currentProgress * priceRange);

  const endProgress = (totalSupply - reserveTokens + tokenAmount) / totalSupply;
  const endPrice = basePrice + (endProgress * priceRange);

  // Average price for the trade
  const avgPrice = (startPrice + endPrice) / 2;

  return {
    avgPrice,
    startPrice,
    endPrice,
    totalCost: avgPrice * tokenAmount
  };
};

/**
 * Calculate sell return for a given amount of tokens
 */
TestnetTokenSchema.methods.calculateSellPrice = function(tokenAmount) {
  const { basePrice, maxPrice, reserveTokens } = this.bondingCurve;
  const totalSupply = this.totalSupply;

  // Linear bonding curve
  const currentProgress = (totalSupply - reserveTokens) / totalSupply;
  const priceRange = maxPrice - basePrice;
  const startPrice = basePrice + (currentProgress * priceRange);

  const endProgress = Math.max(0, (totalSupply - reserveTokens - tokenAmount) / totalSupply);
  const endPrice = basePrice + (endProgress * priceRange);

  // Average price for the trade
  const avgPrice = (startPrice + endPrice) / 2;

  return {
    avgPrice,
    startPrice,
    endPrice,
    totalReturn: avgPrice * tokenAmount
  };
};

/**
 * Update price after trade
 */
TestnetTokenSchema.methods.updatePriceAfterTrade = function(isBuy, tokenAmount, solAmount) {
  const { basePrice, maxPrice } = this.bondingCurve;

  if (isBuy) {
    this.currentSupply += tokenAmount;
    this.bondingCurve.reserveSOL += solAmount;
    this.bondingCurve.reserveTokens -= tokenAmount;
  } else {
    this.currentSupply -= tokenAmount;
    this.bondingCurve.reserveSOL -= solAmount;
    this.bondingCurve.reserveTokens += tokenAmount;
  }

  // Update current price
  const progress = this.currentSupply / this.totalSupply;
  this.bondingCurve.currentPrice = basePrice + (progress * (maxPrice - basePrice));

  // Update market cap
  this.marketCap = this.currentSupply * this.bondingCurve.currentPrice;

  // Add to price history
  this.priceHistory.push({
    price: this.bondingCurve.currentPrice,
    timestamp: new Date()
  });

  // Keep only last 1000 price points
  if (this.priceHistory.length > 1000) {
    this.priceHistory = this.priceHistory.slice(-1000);
  }

  return this;
};

/**
 * Add to 24h volume
 */
TestnetTokenSchema.methods.addVolume = function(amount) {
  this.volume24h += amount;
  this.volumeTotal += amount;
  this.transactions += 1;
  return this;
};

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Get tokens by creator
 */
TestnetTokenSchema.statics.getByCreator = async function(creatorAddress, options = {}) {
  const { page = 1, limit = 20, status = 'active' } = options;
  const skip = (page - 1) * limit;

  const query = { creator: creatorAddress };
  if (status !== 'all') {
    query.status = status;
  }

  const [tokens, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    tokens,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get trending tokens
 */
TestnetTokenSchema.statics.getTrending = async function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ volume24h: -1, transactions: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get new tokens
 */
TestnetTokenSchema.statics.getNew = async function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Search tokens
 */
TestnetTokenSchema.statics.search = async function(query, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const searchQuery = {
    status: 'active',
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { symbol: { $regex: query, $options: 'i' } },
      { mint: { $regex: query, $options: 'i' } }
    ]
  };

  const [tokens, total] = await Promise.all([
    this.find(searchQuery)
      .sort({ marketCap: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(searchQuery)
  ]);

  return {
    tokens,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Reset 24h volume (run daily via cron)
 */
TestnetTokenSchema.statics.reset24hVolume = async function() {
  return this.updateMany({}, { volume24h: 0, priceChange24h: 0 });
};

// ------------------------------------
// Pre-save Hooks
// ------------------------------------

TestnetTokenSchema.pre('save', function(next) {
  // Ensure bonding curve has required fields
  if (!this.bondingCurve) {
    this.bondingCurve = {
      type: 'linear',
      basePrice: 0.000001,
      currentPrice: 0.000001,
      maxPrice: 0.01,
      reserveSOL: 0,
      reserveTokens: this.totalSupply
    };
  }

  // Initialize reserve tokens if not set
  if (this.isNew && this.bondingCurve.reserveTokens === 0) {
    this.bondingCurve.reserveTokens = this.totalSupply;
  }

  next();
});

// ------------------------------------
// Export Model
// ------------------------------------

const TestnetToken = mongoose.model('TestnetToken', TestnetTokenSchema);

export default TestnetToken;
export { TestnetTokenSchema };
