/**
 * Liquidity Pool Model
 * Tracks Raydium/Orca liquidity pools created for tokens
 */

import mongoose from 'mongoose';

const LiquidityPoolSchema = new mongoose.Schema({
  // Token information
  tokenMint: {
    type: String,
    required: true,
    index: true
  },

  // Pool addresses
  poolAddress: {
    type: String,
    required: true,
    unique: true
  },
  poolId: {
    type: String,
    required: true
  },
  marketId: {
    type: String,
    default: null
  },

  // Creator
  creator: {
    type: String,
    required: true,
    index: true
  },

  // Reserves
  baseReserve: {
    type: Number,
    default: 0
  }, // SOL
  quoteReserve: {
    type: Number,
    default: 0
  }, // Tokens
  lpSupply: {
    type: Number,
    default: 0
  },

  // Creation transaction signatures
  creationSignatures: [{
    type: {
      type: String,
      enum: ['market_creation', 'pool_initialization', 'add_liquidity']
    },
    signature: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    solscanUrl: String
  }],

  // Pool status
  status: {
    type: String,
    enum: ['ACTIVE', 'PAUSED', 'CLOSED'],
    default: 'ACTIVE'
  },

  // Network
  network: {
    type: String,
    enum: ['devnet', 'testnet', 'mainnet-beta'],
    default: 'devnet'
  },

  // Pool type
  poolType: {
    type: String,
    enum: ['raydium', 'orca'],
    default: 'raydium'
  }

}, {
  timestamps: true
});

// Indexes
LiquidityPoolSchema.index({ tokenMint: 1, status: 1 });
LiquidityPoolSchema.index({ creator: 1, createdAt: -1 });

// Virtual for Solscan URL
LiquidityPoolSchema.virtual('solscanPoolUrl').get(function() {
  const cluster = this.network === 'mainnet-beta' ? '' : `?cluster=${this.network}`;
  return `https://solscan.io/account/${this.poolAddress}${cluster}`;
});

// Static method to get pool by token
LiquidityPoolSchema.statics.getByToken = async function(tokenMint) {
  return this.findOne({ tokenMint, status: 'ACTIVE' });
};

// Static method to get pools by creator
LiquidityPoolSchema.statics.getByCreator = async function(creatorAddress) {
  return this.find({ creator: creatorAddress }).sort({ createdAt: -1 });
};

export default mongoose.model('LiquidityPool', LiquidityPoolSchema);
