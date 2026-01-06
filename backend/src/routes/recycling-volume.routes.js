/**
 * Recycling Volume Bot Routes
 */

import express from 'express';
import recyclingVolumeController from '../controllers/recycling-volume.controller.js';

const router = express.Router();

/**
 * @route   POST /api/recycling-volume/start
 * @desc    Start recycling volume bot session
 * @access  Public
 */
router.post('/start', recyclingVolumeController.startSession.bind(recyclingVolumeController));

/**
 * @route   GET /api/recycling-volume/sessions
 * @desc    Get all active sessions
 * @access  Public
 */
router.get('/sessions', recyclingVolumeController.getSessions.bind(recyclingVolumeController));

/**
 * @route   GET /api/recycling-volume/session/:sessionId
 * @desc    Get session status
 * @access  Public
 */
router.get('/session/:sessionId', recyclingVolumeController.getSession.bind(recyclingVolumeController));

/**
 * @route   POST /api/recycling-volume/session/:sessionId/stop
 * @desc    Stop session
 * @access  Public
 */
router.post('/session/:sessionId/stop', recyclingVolumeController.stopSession.bind(recyclingVolumeController));

export default router;
