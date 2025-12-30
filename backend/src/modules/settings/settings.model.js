// ===========================================
// Fusion - App Settings Model
// ===========================================

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ------------------------------------
// RPC Endpoint Sub-Schema
// ------------------------------------

const RpcEndpointSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  httpUrl: {
    type: String,
    required: true
  },
  wsUrl: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  provider: {
    type: String,
    enum: ['chainstack', 'helius', 'quicknode', 'triton', 'alchemy', 'custom'],
    default: 'custom'
  },
  network: {
    type: String,
    enum: ['mainnet-beta', 'devnet', 'testnet'],
    required: true
  },
  // Health tracking
  lastHealthCheck: {
    type: Date,
    default: null
  },
  isHealthy: {
    type: Boolean,
    default: true
  },
  latencyMs: {
    type: Number,
    default: 0
  }
}, { _id: true });

// ------------------------------------
// Main Settings Schema (Singleton)
// ------------------------------------

const SettingsSchema = new Schema({
  // Singleton identifier
  _singleton: {
    type: Boolean,
    default: true,
    unique: true
  },

  // ------------------------------------
  // RPC Configuration
  // ------------------------------------
  rpc: {
    endpoints: {
      type: [RpcEndpointSchema],
      default: []
    },
    // Current active network
    activeNetwork: {
      type: String,
      enum: ['mainnet-beta', 'devnet', 'testnet'],
      default: 'devnet'
    },
    // Auto-failover to backup endpoints
    autoFailover: {
      type: Boolean,
      default: true
    },
    // Health check interval (ms)
    healthCheckInterval: {
      type: Number,
      default: 60000 // 1 minute
    }
  },

  // ------------------------------------
  // Hot Wallet Tracking Settings
  // ------------------------------------
  hotWalletTracking: {
    enabled: {
      type: Boolean,
      default: true
    },
    // Minimum SOL transfer to track
    minTransferAmount: {
      type: Number,
      default: 0.01
    },
    // Hours to watch subwallets
    subwalletWatchHours: {
      type: Number,
      default: 24
    },
    // Max active subwallets
    maxActiveSubwallets: {
      type: Number,
      default: 100
    },
    // Auto-archive inactive subwallets
    autoArchive: {
      type: Boolean,
      default: true
    }
  },

  // ------------------------------------
  // Trading Settings (Global Defaults)
  // ------------------------------------
  trading: {
    enabled: {
      type: Boolean,
      default: true
    },
    // Default slippage (basis points)
    defaultSlippageBps: {
      type: Number,
      default: 100
    },
    // Default priority fee (lamports)
    defaultPriorityFee: {
      type: Number,
      default: 10000
    },
    // Max SOL per trade
    maxSolPerTrade: {
      type: Number,
      default: 10
    },
    // Preferred DEX
    preferredDex: {
      type: String,
      enum: ['jupiter', 'raydium', 'auto'],
      default: 'auto'
    },
    // Enable auto trading globally
    autoTradingEnabled: {
      type: Boolean,
      default: false
    }
  },

  // ------------------------------------
  // Volume Bot Settings (Global Defaults)
  // ------------------------------------
  volumeBot: {
    enabled: {
      type: Boolean,
      default: true
    },
    // Max concurrent sessions per user
    maxSessionsPerUser: {
      type: Number,
      default: 1
    },
    // Max total SOL deposit
    maxDepositSol: {
      type: Number,
      default: 50
    },
    // Default network for volume bot
    defaultNetwork: {
      type: String,
      enum: ['mainnet-beta', 'devnet', 'testnet'],
      default: 'devnet'
    }
  },

  // ------------------------------------
  // Notification Settings
  // ------------------------------------
  notifications: {
    // Enable WebSocket notifications
    enabled: {
      type: Boolean,
      default: true
    },
    // Sound alerts
    soundEnabled: {
      type: Boolean,
      default: true
    }
  },

  // ------------------------------------
  // System Settings
  // ------------------------------------
  system: {
    // Maintenance mode
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    maintenanceMessage: {
      type: String,
      default: 'System is under maintenance. Please try again later.'
    },
    // Data retention (days)
    dataRetentionDays: {
      type: Number,
      default: 30
    },
    // Log level
    logLevel: {
      type: String,
      enum: ['error', 'warn', 'info', 'debug'],
      default: 'info'
    }
  }

}, {
  timestamps: true,
  collection: 'settings'
});

// ------------------------------------
// Ensure Singleton
// ------------------------------------

SettingsSchema.index({ _singleton: 1 }, { unique: true });

// ------------------------------------
// Statics
// ------------------------------------

/**
 * Get settings (create if not exists)
 */
SettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ _singleton: true });
  
  if (!settings) {
    settings = await this.create({ _singleton: true });
  }
  
  return settings;
};

/**
 * Update settings
 */
SettingsSchema.statics.updateSettings = async function(updates) {
  const settings = await this.getSettings();
  
  // Deep merge updates
  Object.keys(updates).forEach(key => {
    if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
      settings[key] = { ...settings[key].toObject(), ...updates[key] };
    } else {
      settings[key] = updates[key];
    }
  });
  
  return settings.save();
};

/**
 * Add RPC endpoint
 */
SettingsSchema.statics.addRpcEndpoint = async function(endpoint) {
  const settings = await this.getSettings();
  
  // If this is first endpoint or marked as primary, make it primary
  if (settings.rpc.endpoints.length === 0 || endpoint.isPrimary) {
    settings.rpc.endpoints.forEach(ep => {
      if (ep.network === endpoint.network) {
        ep.isPrimary = false;
      }
    });
  }
  
  settings.rpc.endpoints.push(endpoint);
  return settings.save();
};

/**
 * Remove RPC endpoint
 */
SettingsSchema.statics.removeRpcEndpoint = async function(endpointId) {
  const settings = await this.getSettings();
  
  const endpoint = settings.rpc.endpoints.id(endpointId);
  if (endpoint) {
    const wasPrimary = endpoint.isPrimary;
    const network = endpoint.network;
    
    endpoint.deleteOne();
    
    // If removed endpoint was primary, set another as primary
    if (wasPrimary) {
      const sameNetworkEndpoint = settings.rpc.endpoints.find(ep => ep.network === network);
      if (sameNetworkEndpoint) {
        sameNetworkEndpoint.isPrimary = true;
      }
    }
  }
  
  return settings.save();
};

/**
 * Set primary RPC endpoint
 */
SettingsSchema.statics.setPrimaryEndpoint = async function(endpointId) {
  const settings = await this.getSettings();
  
  const endpoint = settings.rpc.endpoints.id(endpointId);
  if (!endpoint) {
    throw new Error('Endpoint not found');
  }
  
  // Remove primary from other endpoints of same network
  settings.rpc.endpoints.forEach(ep => {
    if (ep.network === endpoint.network) {
      ep.isPrimary = ep._id.toString() === endpointId;
    }
  });
  
  return settings.save();
};

/**
 * Get active RPC endpoint for network
 */
SettingsSchema.statics.getActiveEndpoint = async function(network) {
  const settings = await this.getSettings();
  
  // Find primary endpoint for network
  let endpoint = settings.rpc.endpoints.find(
    ep => ep.network === network && ep.isPrimary && ep.isActive && ep.isHealthy
  );
  
  // Fallback to any healthy endpoint
  if (!endpoint) {
    endpoint = settings.rpc.endpoints.find(
      ep => ep.network === network && ep.isActive && ep.isHealthy
    );
  }
  
  return endpoint || null;
};

/**
 * Update endpoint health
 */
SettingsSchema.statics.updateEndpointHealth = async function(endpointId, isHealthy, latencyMs) {
  const settings = await this.getSettings();
  
  const endpoint = settings.rpc.endpoints.id(endpointId);
  if (endpoint) {
    endpoint.isHealthy = isHealthy;
    endpoint.latencyMs = latencyMs;
    endpoint.lastHealthCheck = new Date();
  }
  
  return settings.save();
};

// ------------------------------------
// Export Model
// ------------------------------------

const Settings = mongoose.model('Settings', SettingsSchema);

export default Settings;
export { SettingsSchema };
