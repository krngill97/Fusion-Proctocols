/**
 * Liquidity Routes
 * API endpoints for liquidity pool management
 */

import express from 'express';
import liquidityController from './liquidity.controller.js';

const router = express.Router();

/**
 * @route   POST /api/liquidity/create-pool
 * @desc    Create a new liquidity pool
 * @access  Public (should add auth in production)
 */
router.post('/create-pool', liquidityController.createPool.bind(liquidityController));

/**
 * @route   GET /api/liquidity/pool/:poolAddress
 * @desc    Get pool information by pool address
 * @access  Public
 */
router.get('/pool/:poolAddress', liquidityController.getPool.bind(liquidityController));

/**
 * @route   GET /api/liquidity/token/:tokenMint
 * @desc    Get pool by token mint address
 * @access  Public
 */
router.get('/token/:tokenMint', liquidityController.getPoolByToken.bind(liquidityController));

/**
 * @route   POST /api/liquidity/add
 * @desc    Add liquidity to existing pool
 * @access  Public (should add auth in production)
 */
router.post('/add', liquidityController.addLiquidity.bind(liquidityController));

/**
 * @route   GET /api/liquidity/creator/:creatorAddress
 * @desc    Get all pools by creator address
 * @access  Public
 */
router.get('/creator/:creatorAddress', liquidityController.getPoolsByCreator.bind(liquidityController));

export default router;
