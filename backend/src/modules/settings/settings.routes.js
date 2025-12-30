// ===========================================
// Fusion - Settings Routes
// ===========================================

import { Router } from 'express';
import * as settingsController from './settings.controller.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';

const router = Router();

// All settings routes require authentication
router.use(authenticate);

// ------------------------------------
// General Settings
// ------------------------------------

/**
 * GET /api/settings
 * Get all settings
 */
router.get('/', settingsController.getSettings);

/**
 * PATCH /api/settings
 * Update multiple settings at once
 */
router.patch('/', settingsController.updateSettings);

// ------------------------------------
// RPC Settings
// ------------------------------------

/**
 * GET /api/settings/rpc
 * Get RPC configuration
 */
router.get('/rpc', settingsController.getRpcSettings);

/**
 * POST /api/settings/rpc/endpoints
 * Add new RPC endpoint
 */
router.post('/rpc/endpoints', settingsController.addRpcEndpoint);

/**
 * DELETE /api/settings/rpc/endpoints/:endpointId
 * Remove RPC endpoint
 */
router.delete('/rpc/endpoints/:endpointId', settingsController.removeRpcEndpoint);

/**
 * PATCH /api/settings/rpc/endpoints/:endpointId/primary
 * Set endpoint as primary
 */
router.patch('/rpc/endpoints/:endpointId/primary', settingsController.setPrimaryEndpoint);

/**
 * PATCH /api/settings/rpc/endpoints/:endpointId/toggle
 * Toggle endpoint active status
 */
router.patch('/rpc/endpoints/:endpointId/toggle', settingsController.toggleEndpoint);

/**
 * POST /api/settings/rpc/endpoints/:endpointId/test
 * Test RPC endpoint
 */
router.post('/rpc/endpoints/:endpointId/test', settingsController.testEndpoint);

/**
 * PATCH /api/settings/rpc/network
 * Change active network
 */
router.patch('/rpc/network', settingsController.setActiveNetwork);

// ------------------------------------
// Feature Settings
// ------------------------------------

/**
 * PATCH /api/settings/hot-wallet-tracking
 * Update hot wallet tracking settings
 */
router.patch('/hot-wallet-tracking', settingsController.updateHotWalletSettings);

/**
 * PATCH /api/settings/trading
 * Update trading settings
 */
router.patch('/trading', settingsController.updateTradingSettings);

/**
 * PATCH /api/settings/volume-bot
 * Update volume bot settings
 */
router.patch('/volume-bot', settingsController.updateVolumeBotSettings);

/**
 * PATCH /api/settings/system
 * Update system settings
 */
router.patch('/system', settingsController.updateSystemSettings);

export default router;
