/**
 * Hybrid Recycling Volume Bot Routes
 */

import express from 'express';
import hybridRecyclingVolumeController from '../controllers/hybrid-recycling-volume.controller.js';

const router = express.Router();

/**
 * @route   POST /api/hybrid-recycling-volume/start
 * @desc    Start hybrid recycling volume bot session with real Jupiter swaps
 * @access  Public
 */
router.post('/start', hybridRecyclingVolumeController.startSession.bind(hybridRecyclingVolumeController));

/**
 * @route   GET /api/hybrid-recycling-volume/sessions
 * @desc    Get all active sessions
 * @access  Public
 */
router.get('/sessions', hybridRecyclingVolumeController.getSessions.bind(hybridRecyclingVolumeController));

/**
 * @route   GET /api/hybrid-recycling-volume/session/:sessionId
 * @desc    Get session status
 * @access  Public
 */
router.get('/session/:sessionId', hybridRecyclingVolumeController.getSession.bind(hybridRecyclingVolumeController));

/**
 * @route   POST /api/hybrid-recycling-volume/session/:sessionId/stop
 * @desc    Stop session
 * @access  Public
 */
router.post('/session/:sessionId/stop', hybridRecyclingVolumeController.stopSession.bind(hybridRecyclingVolumeController));

export default router;
