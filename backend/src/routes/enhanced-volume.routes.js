/**
 * Enhanced Volume Bot Routes
 */

import express from 'express';
import enhancedVolumeController from '../controllers/enhanced-volume.controller.js';

const router = express.Router();

/**
 * @route   POST /api/enhanced-volume/sessions
 * @desc    Start enhanced volume bot session with liquidity creation
 * @access  Public
 */
router.post('/sessions', enhancedVolumeController.startSession.bind(enhancedVolumeController));

/**
 * @route   GET /api/enhanced-volume/sessions
 * @desc    Get all sessions
 * @access  Public
 */
router.get('/sessions', enhancedVolumeController.getAllSessions.bind(enhancedVolumeController));

/**
 * @route   GET /api/enhanced-volume/sessions/:sessionId
 * @desc    Get session status
 * @access  Public
 */
router.get('/sessions/:sessionId', enhancedVolumeController.getSession.bind(enhancedVolumeController));

/**
 * @route   POST /api/enhanced-volume/sessions/:sessionId/stop
 * @desc    Stop session
 * @access  Public
 */
router.post('/sessions/:sessionId/stop', enhancedVolumeController.stopSession.bind(enhancedVolumeController));

export default router;
