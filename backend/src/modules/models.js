// ===========================================
// Fusion - Models Index
// ===========================================

// Export all models from a central location

export { default as User } from './auth/auth.model.js';
export { default as HotWallet } from './hot-wallet-tracker/hot-wallet.model.js';
export { default as Subwallet } from './subwallet-analyzer/subwallet.model.js';
export { default as UserWallet } from './user-wallet-tracker/user-wallet.model.js';
export { default as Trade } from './trading-engine/trading.model.js';
export { default as VolumeSession } from './volume-bot/volume.model.js';
export { default as TransferLog } from './hot-wallet-tracker/transfer-log.model.js';
export { default as Settings } from './settings/settings.model.js';

// Re-export schemas if needed
export { UserSchema } from './auth/auth.model.js';
export { HotWalletSchema } from './hot-wallet-tracker/hot-wallet.model.js';
export { SubwalletSchema } from './subwallet-analyzer/subwallet.model.js';
export { UserWalletSchema } from './user-wallet-tracker/user-wallet.model.js';
export { TradeSchema } from './trading-engine/trading.model.js';
export { VolumeSessionSchema } from './volume-bot/volume.model.js';
export { TransferLogSchema } from './hot-wallet-tracker/transfer-log.model.js';
export { SettingsSchema } from './settings/settings.model.js';
