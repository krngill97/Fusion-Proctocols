// ===========================================
// Fusion - User Model
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// Trading Wallet Sub-Schema
// ------------------------------------

const TradingWalletSchema = new Schema({
  publicKey: {
    type: String,
    required: true,
    index: true
  },
  encryptedPrivateKey: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: 'Trading Wallet',
    maxlength: 100
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// ------------------------------------
// Notification Preferences Sub-Schema
// ------------------------------------

const NotificationPrefsSchema = new Schema({
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
  onPoolCreation: {
    type: Boolean,
    default: true
  },
  onLargeTransfer: {
    type: Boolean,
    default: true
  }
}, { _id: false });

// ------------------------------------
// User Preferences Sub-Schema
// ------------------------------------

const PreferencesSchema = new Schema({
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'dark'
  },
  defaultSlippage: {
    type: Number,
    default: 100, // 1% in basis points
    min: 10,
    max: 1000
  },
  defaultPriorityFee: {
    type: Number,
    default: 10000, // lamports
    min: 0,
    max: 1000000
  },
  notifications: {
    type: NotificationPrefsSchema,
    default: () => ({})
  }
}, { _id: false });

// ------------------------------------
// Auto Trade Settings Sub-Schema
// ------------------------------------

const AutoTradeSettingsSchema = new Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  maxSolPerTrade: {
    type: Number,
    default: 0.1,
    min: 0.001,
    max: 10
  },
  takeProfitPercent: {
    type: Number,
    default: 50,
    min: 1,
    max: 1000
  },
  stopLossPercent: {
    type: Number,
    default: 20,
    min: 1,
    max: 100
  },
  enabledTriggers: {
    type: [String],
    enum: ['mint', 'buy', 'pool'],
    default: ['mint']
  },
  slippageBps: {
    type: Number,
    default: 100,
    min: 10,
    max: 1000
  },
  priorityFee: {
    type: Number,
    default: 50000,
    min: 0,
    max: 1000000
  },
  preferredDex: {
    type: String,
    enum: ['jupiter', 'raydium', 'auto'],
    default: 'auto'
  }
}, { _id: false });

// ------------------------------------
// Main User Schema
// ------------------------------------

const UserSchema = new Schema({
  walletAddress: {
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
  
  nonce: {
    type: String,
    default: null
  },
  
  lastLogin: {
    type: Date,
    default: null
  },
  
  preferences: {
    type: PreferencesSchema,
    default: () => ({})
  },
  
  tradingWallets: {
    type: [TradingWalletSchema],
    default: [],
    validate: {
      validator: function(wallets) {
        return wallets.length <= 10; // Max 10 trading wallets
      },
      message: 'Maximum 10 trading wallets allowed'
    }
  },
  
  autoTradeSettings: {
    type: AutoTradeSettingsSchema,
    default: () => ({})
  },
  
  stats: {
    totalTrades: {
      type: Number,
      default: 0
    },
    profitableTrades: {
      type: Number,
      default: 0
    },
    totalVolume: {
      type: Number,
      default: 0 // in SOL
    },
    totalProfit: {
      type: Number,
      default: 0 // in SOL
    }
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ------------------------------------
// Indexes
// ------------------------------------

UserSchema.index({ createdAt: -1 });
UserSchema.index({ lastLogin: -1 });
UserSchema.index({ 'tradingWallets.publicKey': 1 });

// ------------------------------------
// Virtuals
// ------------------------------------

UserSchema.virtual('winRate').get(function() {
  if (this.stats.totalTrades === 0) return 0;
  return ((this.stats.profitableTrades / this.stats.totalTrades) * 100).toFixed(2);
});

UserSchema.virtual('defaultTradingWallet').get(function() {
  return this.tradingWallets.find(w => w.isDefault) || this.tradingWallets[0] || null;
});

// ------------------------------------
// Methods
// ------------------------------------

/**
 * Add a trading wallet
 */
UserSchema.methods.addTradingWallet = async function(publicKey, encryptedPrivateKey, label) {
  // Check if wallet already exists
  const exists = this.tradingWallets.some(w => w.publicKey === publicKey);
  if (exists) {
    throw new Error('Trading wallet already exists');
  }
  
  // If this is the first wallet, make it default
  const isDefault = this.tradingWallets.length === 0;
  
  this.tradingWallets.push({
    publicKey,
    encryptedPrivateKey,
    label: label || `Wallet ${this.tradingWallets.length + 1}`,
    isDefault
  });
  
  return this.save();
};

/**
 * Remove a trading wallet
 */
UserSchema.methods.removeTradingWallet = async function(walletId) {
  const wallet = this.tradingWallets.id(walletId);
  if (!wallet) {
    throw new Error('Trading wallet not found');
  }
  
  const wasDefault = wallet.isDefault;
  wallet.deleteOne();
  
  // If removed wallet was default, set first remaining as default
  if (wasDefault && this.tradingWallets.length > 0) {
    this.tradingWallets[0].isDefault = true;
  }
  
  return this.save();
};

/**
 * Set default trading wallet
 */
UserSchema.methods.setDefaultWallet = async function(walletId) {
  this.tradingWallets.forEach(w => {
    w.isDefault = w._id.toString() === walletId;
  });
  return this.save();
};

/**
 * Update stats after a trade
 */
UserSchema.methods.updateTradeStats = async function(tradeResult) {
  this.stats.totalTrades += 1;
  this.stats.totalVolume += tradeResult.volume || 0;
  
  if (tradeResult.profit > 0) {
    this.stats.profitableTrades += 1;
    this.stats.totalProfit += tradeResult.profit;
  } else {
    this.stats.totalProfit += tradeResult.profit; // Could be negative
  }
  
  return this.save();
};

/**
 * Generate new nonce for authentication
 */
UserSchema.methods.generateNonce = async function() {
  const crypto = await import('crypto');
  this.nonce = crypto.randomBytes(32).toString('hex');
  return this.save();
};

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Find or create user by wallet address
 */
UserSchema.statics.findOrCreate = async function(walletAddress) {
  let user = await this.findOne({ walletAddress });
  
  if (!user) {
    user = await this.create({ walletAddress });
  }
  
  return user;
};

/**
 * Find user by trading wallet
 */
UserSchema.statics.findByTradingWallet = async function(publicKey) {
  return this.findOne({ 'tradingWallets.publicKey': publicKey });
};

// ------------------------------------
// Pre-save Hooks
// ------------------------------------

UserSchema.pre('save', function(next) {
  // Ensure only one default wallet
  const defaults = this.tradingWallets.filter(w => w.isDefault);
  if (defaults.length > 1) {
    this.tradingWallets.forEach((w, i) => {
      w.isDefault = i === 0;
    });
  }
  next();
});

// ------------------------------------
// Export Model
// ------------------------------------

const User = mongoose.model('User', UserSchema);

export default User;
export { UserSchema };
