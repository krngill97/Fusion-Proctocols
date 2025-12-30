/**
 * Liquidity Service
 * Handles liquidity pool creation and management
 *
 * NOTE: Full Raydium integration on devnet requires OpenBook market creation
 * which is complex. This service provides a simulated approach for devnet
 * that tracks pool data in MongoDB while documenting the real Raydium flow.
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import LiquidityPool from './liquidity.model.js';
import TestnetToken from '../testnet-tokens/testnet-token.model.js';

const DEVNET_ENDPOINT = process.env.CHAINSTACK_RPC_HTTP || 'https://api.devnet.solana.com';

class LiquidityService {
  constructor() {
    this.connection = new Connection(DEVNET_ENDPOINT, 'confirmed');
  }

  /**
   * Parse private key from either JSON array or base58 format
   */
  parsePrivateKey(keyInput) {
    if (!keyInput || typeof keyInput !== 'string') {
      throw new Error('Private key must be a string');
    }

    if (keyInput.trim().startsWith('[')) {
      try {
        return Uint8Array.from(JSON.parse(keyInput));
      } catch (error) {
        throw new Error(`Invalid JSON array format: ${error.message}`);
      }
    }

    try {
      const decoded = bs58.decode(keyInput);
      if (decoded.length !== 64) {
        throw new Error(`Invalid private key length: expected 64 bytes, got ${decoded.length}`);
      }
      return decoded;
    } catch (error) {
      throw new Error(`Invalid base58 format: ${error.message}`);
    }
  }

  /**
   * Create a liquidity pool (simulated for devnet)
   *
   * For a real Raydium pool on devnet, you would need to:
   * 1. Create an OpenBook market (requires ~3 SOL)
   * 2. Initialize Raydium pool with market ID
   * 3. Add initial liquidity
   *
   * This implementation creates a simulated pool that tracks the data
   * and can be used with the rest of the trading flow.
   */
  async createPool({ tokenMint, solAmount, tokenAmount, walletPrivateKey, network = 'devnet' }) {
    try {
      // Parse wallet private key
      const walletKeypair = Keypair.fromSecretKey(this.parsePrivateKey(walletPrivateKey));
      const walletPublicKey = walletKeypair.publicKey;

      console.log(`Creating liquidity pool for token: ${tokenMint}`);
      console.log(`Wallet: ${walletPublicKey.toBase58()}`);
      console.log(`Initial liquidity: ${solAmount} SOL, ${tokenAmount} tokens`);

      // Check if pool already exists
      const existingPool = await LiquidityPool.findOne({ tokenMint, status: 'ACTIVE' });
      if (existingPool) {
        throw new Error(`Active pool already exists for token ${tokenMint}`);
      }

      // Get token from database
      const token = await TestnetToken.findOne({ mint: tokenMint });
      if (!token) {
        throw new Error(`Token ${tokenMint} not found in database`);
      }

      // Generate pool address (simulated)
      const poolKeypair = Keypair.generate();
      const poolAddress = poolKeypair.publicKey.toBase58();
      const poolId = `pool_${Date.now()}`;

      // For devnet simulation, we'll create a record of the pool
      // In production, this would be replaced with actual Raydium pool creation
      const signatures = [];

      // Simulate market creation signature
      signatures.push({
        type: 'market_creation',
        signature: `sim_market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        solscanUrl: `https://solscan.io/tx/simulated?cluster=${network}`
      });

      // Simulate pool initialization signature
      signatures.push({
        type: 'pool_initialization',
        signature: `sim_pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        solscanUrl: `https://solscan.io/account/${poolAddress}?cluster=${network}`
      });

      // Simulate add liquidity signature
      signatures.push({
        type: 'add_liquidity',
        signature: `sim_liq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        solscanUrl: `https://solscan.io/tx/simulated?cluster=${network}`
      });

      // Create pool record in database
      const pool = await LiquidityPool.create({
        tokenMint,
        poolAddress,
        poolId,
        marketId: `market_${Date.now()}`,
        creator: walletPublicKey.toBase58(),
        baseReserve: solAmount,
        quoteReserve: tokenAmount,
        lpSupply: Math.sqrt(solAmount * tokenAmount), // Simplified LP calculation
        creationSignatures: signatures,
        status: 'ACTIVE',
        network,
        poolType: 'raydium'
      });

      // Update token status to LIQUIDITY_ADDED
      await token.transitionToLiquidityAdded({
        poolAddress,
        poolId,
        solAmount,
        tokenAmount
      });

      console.log(`✅ Pool created successfully: ${poolAddress}`);

      return {
        success: true,
        poolAddress,
        poolId,
        marketId: pool.marketId,
        signatures: pool.creationSignatures,
        initialLiquidity: {
          sol: solAmount,
          tokens: tokenAmount,
          lpTokens: pool.lpSupply
        },
        solscanUrls: signatures.map(s => s.solscanUrl),
        note: 'This is a simulated pool for devnet. For mainnet, real Raydium pool creation would be used.'
      };

    } catch (error) {
      console.error('Create pool error:', error);
      throw error;
    }
  }

  /**
   * Get pool information
   */
  async getPoolInfo(poolAddress) {
    try {
      const pool = await LiquidityPool.findOne({ poolAddress });
      if (!pool) {
        throw new Error(`Pool ${poolAddress} not found`);
      }

      // Calculate current price from reserves
      const price = pool.baseReserve > 0 ? pool.quoteReserve / pool.baseReserve : 0;

      return {
        success: true,
        pool: {
          address: pool.poolAddress,
          tokenMint: pool.tokenMint,
          baseMint: 'So11111111111111111111111111111111111111112', // SOL
          baseReserve: pool.baseReserve,
          quoteReserve: pool.quoteReserve,
          lpSupply: pool.lpSupply,
          price,
          status: pool.status,
          poolType: pool.poolType,
          network: pool.network,
          createdAt: pool.createdAt
        }
      };
    } catch (error) {
      console.error('Get pool info error:', error);
      throw error;
    }
  }

  /**
   * Add liquidity to existing pool
   */
  async addLiquidity({ poolAddress, solAmount, tokenAmount, walletPrivateKey }) {
    try {
      const pool = await LiquidityPool.findOne({ poolAddress, status: 'ACTIVE' });
      if (!pool) {
        throw new Error(`Active pool ${poolAddress} not found`);
      }

      // Update reserves
      pool.baseReserve += solAmount;
      pool.quoteReserve += tokenAmount;
      pool.lpSupply += Math.sqrt(solAmount * tokenAmount);

      await pool.save();

      // Update token liquidity
      const token = await TestnetToken.findOne({ mint: pool.tokenMint });
      if (token) {
        token.updateLiquidity(pool.baseReserve, pool.quoteReserve);
        await token.save();
      }

      return {
        success: true,
        poolAddress,
        newReserves: {
          sol: pool.baseReserve,
          tokens: pool.quoteReserve
        }
      };
    } catch (error) {
      console.error('Add liquidity error:', error);
      throw error;
    }
  }

  /**
   * Get all pools by creator
   */
  async getPoolsByCreator(creatorAddress) {
    try {
      const pools = await LiquidityPool.find({ creator: creatorAddress })
        .sort({ createdAt: -1 })
        .lean();

      return {
        success: true,
        pools
      };
    } catch (error) {
      console.error('Get pools by creator error:', error);
      throw error;
    }
  }

  /**
   * Get pool by token mint
   */
  async getPoolByToken(tokenMint) {
    try {
      const pool = await LiquidityPool.findOne({ tokenMint, status: 'ACTIVE' });

      if (!pool) {
        return {
          success: false,
          message: 'No active pool found for this token'
        };
      }

      return {
        success: true,
        pool
      };
    } catch (error) {
      console.error('Get pool by token error:', error);
      throw error;
    }
  }
}

export default new LiquidityService();
