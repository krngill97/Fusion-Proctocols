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

/**
 * @route   POST /api/liquidity/create-raydium-pool
 * @desc    Create a REAL Raydium pool on-chain (requires ~1.5 SOL)
 * @access  Public (should add auth in production)
 */
router.post('/create-raydium-pool', liquidityController.createRaydiumPool.bind(liquidityController));

/**
 * @route   POST /api/liquidity/create-simple-pool
 * @desc    Create a simple pool with database tracking only (for testing with low SOL)
 * @access  Public (should add auth in production)
 */
router.post('/create-simple-pool', liquidityController.createSimplePool.bind(liquidityController));

/**
 * @route   GET /api/liquidity/check-jupiter/:tokenMint
 * @desc    Check if token has real liquidity on Jupiter DEX
 * @access  Public
 */
router.get('/check-jupiter/:tokenMint', liquidityController.checkJupiterLiquidity.bind(liquidityController));

export default router;
