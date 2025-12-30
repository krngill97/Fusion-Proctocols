/**
 * Devnet Volume Bot Routes
 */

import express from 'express';
import devnetVolumeController from '../controllers/devnet-volume.controller.js';

const router = express.Router();

/**
 * @route   POST /api/devnet-volume/sessions
 * @desc    Start a new devnet volume generation session
 * @access  Public
 */
router.post('/sessions', devnetVolumeController.startSession);

/**
 * @route   GET /api/devnet-volume/sessions
 * @desc    Get all sessions
 * @access  Public
 */
router.get('/sessions', devnetVolumeController.getAllSessions);

/**
 * @route   GET /api/devnet-volume/sessions/:sessionId
 * @desc    Get session details
 * @access  Public
 */
router.get('/sessions/:sessionId', devnetVolumeController.getSession);

/**
 * @route   POST /api/devnet-volume/sessions/:sessionId/stop
 * @desc    Stop a running session
 * @access  Public
 */
router.post('/sessions/:sessionId/stop', devnetVolumeController.stopSession);

export default router;
