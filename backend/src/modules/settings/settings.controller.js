// ===========================================
// Fusion - Settings Controller
// ===========================================

import { asyncHandler } from '../../shared/middleware/error-handler.middleware.js';
import Settings from './settings.model.js';
import { logger } from '../../shared/utils/logger.js';
import { getHttpConnection } from '../../config/chainstack.js';

const log = logger.withContext('SettingsController');

// ------------------------------------
// Get All Settings
// ------------------------------------

/**
 * GET /api/settings
 * Get all app settings
 */
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  
  res.json({
    success: true,
    data: settings
  });
});

// ------------------------------------
// Update Settings
// ------------------------------------

/**
 * PATCH /api/settings
 * Update app settings
 */
export const updateSettings = asyncHandler(async (req, res) => {
  const updates = req.body;
  
  // Remove protected fields
  delete updates._id;
  delete updates._singleton;
  delete updates.createdAt;
  delete updates.updatedAt;
  
  const settings = await Settings.updateSettings(updates);
  
  log.info('Settings updated');
  
  res.json({
    success: true,
    data: settings
  });
});

// ------------------------------------
// RPC Endpoints
// ------------------------------------

/**
 * GET /api/settings/rpc
 * Get RPC configuration
 */
export const getRpcSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  
  res.json({
    success: true,
    data: {
      endpoints: settings.rpc.endpoints,
      activeNetwork: settings.rpc.activeNetwork,
      autoFailover: settings.rpc.autoFailover
    }
  });
});

/**
 * POST /api/settings/rpc/endpoints
 * Add new RPC endpoint
 */
export const addRpcEndpoint = asyncHandler(async (req, res) => {
  const { name, httpUrl, wsUrl, provider, network, isPrimary } = req.body;
  
  if (!name || !httpUrl || !wsUrl || !network) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'name, httpUrl, wsUrl, and network are required'
      }
    });
  }
  
  const endpoint = {
    name,
    httpUrl,
    wsUrl,
    provider: provider || 'custom',
    network,
    isPrimary: isPrimary || false,
    isActive: true,
    isHealthy: true
  };
  
  const settings = await Settings.addRpcEndpoint(endpoint);
  
  log.info(`RPC endpoint added: ${name}`);
  
  res.status(201).json({
    success: true,
    data: {
      endpoints: settings.rpc.endpoints
    }
  });
});

/**
 * DELETE /api/settings/rpc/endpoints/:endpointId
 * Remove RPC endpoint
 */
export const removeRpcEndpoint = asyncHandler(async (req, res) => {
  const { endpointId } = req.params;
  
  const settings = await Settings.removeRpcEndpoint(endpointId);
  
  log.info(`RPC endpoint removed: ${endpointId}`);
  
  res.json({
    success: true,
    data: {
      endpoints: settings.rpc.endpoints
    }
  });
});

/**
 * PATCH /api/settings/rpc/endpoints/:endpointId/primary
 * Set endpoint as primary
 */
export const setPrimaryEndpoint = asyncHandler(async (req, res) => {
  const { endpointId } = req.params;
  
  const settings = await Settings.setPrimaryEndpoint(endpointId);
  
  log.info(`Primary RPC endpoint set: ${endpointId}`);
  
  res.json({
    success: true,
    data: {
      endpoints: settings.rpc.endpoints
    }
  });
});

/**
 * PATCH /api/settings/rpc/endpoints/:endpointId/toggle
 * Toggle endpoint active status
 */
export const toggleEndpoint = asyncHandler(async (req, res) => {
  const { endpointId } = req.params;
  
  const settings = await Settings.getSettings();
  const endpoint = settings.rpc.endpoints.id(endpointId);
  
  if (!endpoint) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      }
    });
  }
  
  endpoint.isActive = !endpoint.isActive;
  await settings.save();
  
  res.json({
    success: true,
    data: {
      endpoint: {
        id: endpoint._id,
        name: endpoint.name,
        isActive: endpoint.isActive
      }
    }
  });
});

/**
 * POST /api/settings/rpc/endpoints/:endpointId/test
 * Test RPC endpoint health
 */
export const testEndpoint = asyncHandler(async (req, res) => {
  const { endpointId } = req.params;
  
  const settings = await Settings.getSettings();
  const endpoint = settings.rpc.endpoints.id(endpointId);
  
  if (!endpoint) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      }
    });
  }
  
  // Test the endpoint
  const { Connection } = await import('@solana/web3.js');
  
  const startTime = Date.now();
  let isHealthy = false;
  let latencyMs = 0;
  let blockHeight = 0;
  let error = null;
  
  try {
    const testConnection = new Connection(endpoint.httpUrl, 'confirmed');
    blockHeight = await testConnection.getBlockHeight();
    latencyMs = Date.now() - startTime;
    isHealthy = blockHeight > 0;
  } catch (err) {
    latencyMs = Date.now() - startTime;
    error = err.message;
  }
  
  // Update endpoint health
  await Settings.updateEndpointHealth(endpointId, isHealthy, latencyMs);
  
  res.json({
    success: true,
    data: {
      endpoint: {
        id: endpoint._id,
        name: endpoint.name,
        isHealthy,
        latencyMs,
        blockHeight,
        error
      }
    }
  });
});

/**
 * PATCH /api/settings/rpc/network
 * Change active network
 */
export const setActiveNetwork = asyncHandler(async (req, res) => {
  const { network } = req.body;
  
  if (!['mainnet-beta', 'devnet', 'testnet'].includes(network)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_NETWORK',
        message: 'Invalid network. Must be mainnet-beta, devnet, or testnet'
      }
    });
  }
  
  const settings = await Settings.getSettings();
  settings.rpc.activeNetwork = network;
  await settings.save();
  
  log.info(`Active network changed to: ${network}`);
  
  res.json({
    success: true,
    data: {
      activeNetwork: network
    }
  });
});

// ------------------------------------
// Hot Wallet Tracking Settings
// ------------------------------------

/**
 * PATCH /api/settings/hot-wallet-tracking
 * Update hot wallet tracking settings
 */
export const updateHotWalletSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  
  const {
    enabled,
    minTransferAmount,
    subwalletWatchHours,
    maxActiveSubwallets,
    autoArchive
  } = req.body;
  
  if (enabled !== undefined) settings.hotWalletTracking.enabled = enabled;
  if (minTransferAmount !== undefined) settings.hotWalletTracking.minTransferAmount = minTransferAmount;
  if (subwalletWatchHours !== undefined) settings.hotWalletTracking.subwalletWatchHours = subwalletWatchHours;
  if (maxActiveSubwallets !== undefined) settings.hotWalletTracking.maxActiveSubwallets = maxActiveSubwallets;
  if (autoArchive !== undefined) settings.hotWalletTracking.autoArchive = autoArchive;
  
  await settings.save();
  
  res.json({
    success: true,
    data: {
      hotWalletTracking: settings.hotWalletTracking
    }
  });
});

// ------------------------------------
// Trading Settings
// ------------------------------------

/**
 * PATCH /api/settings/trading
 * Update trading settings
 */
export const updateTradingSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  
  const {
    enabled,
    defaultSlippageBps,
    defaultPriorityFee,
    maxSolPerTrade,
    preferredDex,
    autoTradingEnabled
  } = req.body;
  
  if (enabled !== undefined) settings.trading.enabled = enabled;
  if (defaultSlippageBps !== undefined) settings.trading.defaultSlippageBps = defaultSlippageBps;
  if (defaultPriorityFee !== undefined) settings.trading.defaultPriorityFee = defaultPriorityFee;
  if (maxSolPerTrade !== undefined) settings.trading.maxSolPerTrade = maxSolPerTrade;
  if (preferredDex !== undefined) settings.trading.preferredDex = preferredDex;
  if (autoTradingEnabled !== undefined) settings.trading.autoTradingEnabled = autoTradingEnabled;
  
  await settings.save();
  
  res.json({
    success: true,
    data: {
      trading: settings.trading
    }
  });
});

// ------------------------------------
// Volume Bot Settings
// ------------------------------------

/**
 * PATCH /api/settings/volume-bot
 * Update volume bot settings
 */
export const updateVolumeBotSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  
  const {
    enabled,
    maxSessionsPerUser,
    maxDepositSol,
    defaultNetwork
  } = req.body;
  
  if (enabled !== undefined) settings.volumeBot.enabled = enabled;
  if (maxSessionsPerUser !== undefined) settings.volumeBot.maxSessionsPerUser = maxSessionsPerUser;
  if (maxDepositSol !== undefined) settings.volumeBot.maxDepositSol = maxDepositSol;
  if (defaultNetwork !== undefined) settings.volumeBot.defaultNetwork = defaultNetwork;
  
  await settings.save();
  
  res.json({
    success: true,
    data: {
      volumeBot: settings.volumeBot
    }
  });
});

// ------------------------------------
// System Settings
// ------------------------------------

/**
 * PATCH /api/settings/system
 * Update system settings
 */
export const updateSystemSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  
  const {
    maintenanceMode,
    maintenanceMessage,
    dataRetentionDays,
    logLevel
  } = req.body;
  
  if (maintenanceMode !== undefined) settings.system.maintenanceMode = maintenanceMode;
  if (maintenanceMessage !== undefined) settings.system.maintenanceMessage = maintenanceMessage;
  if (dataRetentionDays !== undefined) settings.system.dataRetentionDays = dataRetentionDays;
  if (logLevel !== undefined) settings.system.logLevel = logLevel;
  
  await settings.save();
  
  res.json({
    success: true,
    data: {
      system: settings.system
    }
  });
});

export default {
  getSettings,
  updateSettings,
  getRpcSettings,
  addRpcEndpoint,
  removeRpcEndpoint,
  setPrimaryEndpoint,
  toggleEndpoint,
  testEndpoint,
  setActiveNetwork,
  updateHotWalletSettings,
  updateTradingSettings,
  updateVolumeBotSettings,
  updateSystemSettings
};
