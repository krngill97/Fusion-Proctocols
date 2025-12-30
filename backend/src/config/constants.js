// ===========================================
// Fusion - Application Constants
// ===========================================

// ------------------------------------
// Solana Program IDs
// ------------------------------------
export const PROGRAM_IDS = {
  // System & Token Programs
  SYSTEM_PROGRAM: '11111111111111111111111111111111',
  TOKEN_PROGRAM: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  TOKEN_2022_PROGRAM: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  ASSOCIATED_TOKEN_PROGRAM: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  
  // DEX Programs
  JUPITER_V6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  RAYDIUM_AMM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  RAYDIUM_CLMM: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  RAYDIUM_CPMM: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
  
  // Pump.fun
  PUMP_FUN: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  PUMP_FUN_MINT_AUTHORITY: 'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM',
  
  // Metadata
  METAPLEX_METADATA: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
};

// ------------------------------------
// Exchange Hot Wallets
// ------------------------------------
export const EXCHANGE_HOT_WALLETS = {
  // DEVELOPMENT: Start with these 2 for testing
  DEV_WALLETS: [
    {
      address: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9',
      exchange: 'binance',
      label: 'Binance Hot Wallet 1'
    },
    {
      address: '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
      exchange: 'kraken',
      label: 'Kraken Hot Wallet 1'
    }
  ],
  
  // PRODUCTION: All 20 hot wallets (add your actual addresses)
  PROD_WALLETS: [
    // Binance
    { address: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', exchange: 'binance', label: 'Binance Hot 1' },
    { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', exchange: 'binance', label: 'Binance Hot 2' },
    
    // Crypto.com
    { address: 'AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSPo9', exchange: 'crypto.com', label: 'Crypto.com Hot 1' },
    
    // KuCoin
    { address: 'BmFdpraQhkiDQE6SnfG5omcA1VwzqfXrwtNYBwWTymy6', exchange: 'kucoin', label: 'KuCoin Hot 1' },
    
    // Kraken
    { address: '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S', exchange: 'kraken', label: 'Kraken Hot 1' },
    
    // OKX
    { address: '5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD', exchange: 'okx', label: 'OKX Hot 1' },
    
    // Bybit
    { address: 'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2', exchange: 'bybit', label: 'Bybit Hot 1' },
    
    // Gate.io
    { address: 'u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w', exchange: 'gate.io', label: 'Gate.io Hot 1' },
    
    // Coinbase
    { address: 'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS', exchange: 'coinbase', label: 'Coinbase Hot 1' },
    
    // HTX (Huobi)
    { address: '88xTWZMeKfiTgbfEmPLdsUCQcZinwUfk25EBQZ21XMAZ', exchange: 'htx', label: 'HTX Hot 1' },
    
    // Add more as needed...
  ]
};

// ------------------------------------
// Wallet Tracking Configuration
// ------------------------------------
export const TRACKING_CONFIG = {
  // Maximum transfers per minute expected from hot wallets
  MAX_TRANSFERS_PER_MINUTE: 10,
  
  // How long to watch a subwallet (hours)
  SUBWALLET_WATCH_DURATION: 24,
  
  // Polling intervals (milliseconds)
  ACTIVE_SUBWALLET_POLL_INTERVAL: 2000,    // 2 seconds
  INACTIVE_SUBWALLET_POLL_INTERVAL: 30000, // 30 seconds
  USER_WALLET_POLL_INTERVAL: 5000,         // 5 seconds
  
  // Minimum SOL transfer to track (filter dust)
  MIN_SOL_TRANSFER: 0.01,
  
  // Maximum active subwallets to track
  MAX_ACTIVE_SUBWALLETS: 100
};

// ------------------------------------
// Trading Configuration
// ------------------------------------
export const TRADING_CONFIG = {
  // Slippage in basis points (100 = 1%)
  DEFAULT_SLIPPAGE_BPS: 100,
  MAX_SLIPPAGE_BPS: 1000, // 10%
  
  // Priority fees (lamports)
  DEFAULT_PRIORITY_FEE: 10000,
  HIGH_PRIORITY_FEE: 100000,
  ULTRA_PRIORITY_FEE: 500000,
  
  // Trade limits
  MIN_TRADE_SOL: 0.001,
  MAX_AUTO_TRADE_SOL: 1,
  MAX_MANUAL_TRADE_SOL: 10,
  
  // Auto-trade defaults
  DEFAULT_TAKE_PROFIT: 50,   // 50%
  DEFAULT_STOP_LOSS: 20,     // 20%
  
  // Rate limits
  MAX_TRADES_PER_MINUTE: 10,
  
  // DEX selection
  DEX_OPTIONS: ['jupiter', 'raydium']
};

// ------------------------------------
// Volume Bot Configuration
// ------------------------------------
export const VOLUME_CONFIG = {
  // Deposit limits (SOL)
  MIN_DEPOSIT: 0.1, // Lowered for devnet testing
  MAX_DEPOSIT: 50,
  
  // Wallet generation
  MIN_WALLETS: 5,
  MAX_WALLETS: 20,
  
  // Transaction frequency (per minute)
  MIN_TX_FREQUENCY: 1,
  MAX_TX_FREQUENCY: 30,
  
  // Amount per transaction (SOL)
  MIN_TX_AMOUNT: 0.001,
  MAX_TX_AMOUNT: 0.5,
  
  // Duration limits (minutes)
  MIN_DURATION: 5,
  MAX_DURATION: 1440, // 24 hours
  
  // Optimal defaults for high volume, low spending
  OPTIMAL_DEFAULTS: {
    walletCount: 10,
    txFrequency: 10,
    minAmount: 0.001,
    maxAmount: 0.01,
    buyRatio: 0.6, // 60% buys, 40% sells
  }
};

// ------------------------------------
// Database Configuration
// ------------------------------------
export const DB_CONFIG = {
  // Data retention (days)
  DATA_RETENTION_DAYS: 30,
  
  // Collection names
  COLLECTIONS: {
    USERS: 'users',
    HOT_WALLETS: 'hotWallets',
    SUBWALLETS: 'subwallets',
    USER_WALLETS: 'userWallets',
    TRADES: 'trades',
    VOLUME_SESSIONS: 'volumeSessions',
    TRANSFER_LOGS: 'transferLogs',
    SIGNALS: 'signals'
  }
};

// ------------------------------------
// WebSocket Events
// ------------------------------------
export const WS_EVENTS = {
  // Client -> Server
  SUBSCRIBE_HOT_WALLETS: 'subscribe:hotWallets',
  SUBSCRIBE_SUBWALLETS: 'subscribe:subwallets',
  SUBSCRIBE_USER_WALLETS: 'subscribe:userWallets',
  SUBSCRIBE_TRADES: 'subscribe:trades',
  SUBSCRIBE_VOLUME: 'subscribe:volume',
  
  // Server -> Client
  HOT_WALLET_TRANSFER: 'hotWallet:transfer',
  SUBWALLET_ACTIVITY: 'subwallet:activity',
  SUBWALLET_MINT: 'subwallet:mint',
  SUBWALLET_POOL: 'subwallet:pool',
  SUBWALLET_BUY: 'subwallet:buy',
  SUBWALLET_NEW: 'subwallet:new',
  SUBWALLET_ACTIVITY: 'subwallet:activity',
  USER_WALLET_SIGNAL: 'userWallet:signal',
  TRADE_UPDATE: 'trade:update',
  VOLUME_UPDATE: 'volume:update',
  
  // System
  CONNECTED: 'connected',
  AUTHENTICATED: 'authenticated',
  SUBSCRIBED: 'subscribed',
  UNSUBSCRIBED: 'unsubscribed',
  ERROR: 'error',
  RECONNECT: 'reconnect',
  SYSTEM_MAINTENANCE: 'system:maintenance',
  NOTIFICATION: 'notification'
};

// ------------------------------------
// API Response Codes
// ------------------------------------
export const RESPONSE_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500
};

// ------------------------------------
// Signal Types
// ------------------------------------
export const SIGNAL_TYPES = {
  MINT: 'mint',
  BUY: 'buy',
  SELL: 'sell',
  POOL_CREATED: 'pool_created',
  POOL_INTERACTION: 'pool_interaction',
  LARGE_TRANSFER: 'large_transfer'
};

// ------------------------------------
// Network Endpoints (Fallbacks)
// ------------------------------------
export const NETWORK_ENDPOINTS = {
  'mainnet-beta': {
    http: 'https://api.mainnet-beta.solana.com',
    ws: 'wss://api.mainnet-beta.solana.com'
  },
  'devnet': {
    http: 'https://api.devnet.solana.com',
    ws: 'wss://api.devnet.solana.com'
  },
  'testnet': {
    http: 'https://api.testnet.solana.com',
    ws: 'wss://api.testnet.solana.com'
  }
};
