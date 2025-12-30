// ===========================================
// Fusion - Authentication Service
// ===========================================

import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import User from './auth.model.js';
import { logger } from '../../shared/utils/logger.js';
import { randomHex } from '../../shared/services/encryption.service.js';
import { cache } from '../../config/redis.js';
import { 
  AuthenticationError, 
  ValidationError 
} from '../../shared/middleware/error-handler.middleware.js';

const log = logger.withContext('AuthService');

// ------------------------------------
// Configuration
// ------------------------------------

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// Nonce expiry in seconds (5 minutes)
const NONCE_EXPIRY = 300;

// ------------------------------------
// Validate Configuration
// ------------------------------------

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

// ------------------------------------
// Nonce Management
// ------------------------------------

/**
 * Generate a nonce for wallet signature verification
 */
export const generateNonce = async (walletAddress) => {
  // Validate wallet address
  try {
    new PublicKey(walletAddress);
  } catch {
    throw new ValidationError('Invalid wallet address');
  }

  // Generate random nonce
  const nonce = randomHex(32);
  
  // Store in Redis with expiry
  const cacheKey = `nonce:${walletAddress}`;
  await cache.set(cacheKey, nonce, NONCE_EXPIRY);
  
  // Create message to sign
  const message = createSignMessage(walletAddress, nonce);
  
  log.debug(`Nonce generated for wallet: ${walletAddress.slice(0, 8)}...`);
  
  return {
    nonce,
    message,
    expiresIn: NONCE_EXPIRY
  };
};

/**
 * Create the message that wallet will sign
 */
const createSignMessage = (walletAddress, nonce) => {
  const timestamp = Date.now();
  
  return `Fusion Authentication

Wallet: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${timestamp}

Sign this message to authenticate with Fusion.
This request will not trigger a blockchain transaction or cost any gas fees.`;
};

/**
 * Verify nonce is valid and not expired
 */
const verifyNonce = async (walletAddress, nonce) => {
  const cacheKey = `nonce:${walletAddress}`;
  const storedNonce = await cache.get(cacheKey);
  
  if (!storedNonce) {
    throw new AuthenticationError('Nonce expired or not found. Please request a new one.');
  }
  
  if (storedNonce !== nonce) {
    throw new AuthenticationError('Invalid nonce');
  }
  
  // Delete nonce after use (one-time use)
  await cache.del(cacheKey);
  
  return true;
};

// ------------------------------------
// Signature Verification
// ------------------------------------

/**
 * Verify wallet signature
 */
export const verifySignature = async (walletAddress, signature, message) => {
  try {
    // Decode the signature from base58
    const signatureBytes = bs58.decode(signature);
    
    // Get public key bytes
    const publicKeyBytes = new PublicKey(walletAddress).toBytes();
    
    // Encode message to bytes
    const messageBytes = new TextEncoder().encode(message);
    
    // Verify signature using nacl
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );
    
    if (!isValid) {
      throw new AuthenticationError('Invalid signature');
    }
    
    log.debug(`Signature verified for wallet: ${walletAddress.slice(0, 8)}...`);
    
    return true;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    log.error(`Signature verification failed: ${error.message}`);
    throw new AuthenticationError('Signature verification failed');
  }
};

// ------------------------------------
// JWT Token Management
// ------------------------------------

/**
 * Generate access token
 */
export const generateAccessToken = (user) => {
  const payload = {
    userId: user._id.toString(),
    walletAddress: user.walletAddress,
    type: 'access'
  };
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY,
    issuer: 'fusion',
    audience: 'fusion-client'
  });
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (user) => {
  const payload = {
    userId: user._id.toString(),
    walletAddress: user.walletAddress,
    type: 'refresh'
  };
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY,
    issuer: 'fusion',
    audience: 'fusion-client'
  });
};

/**
 * Generate both tokens
 */
export const generateTokens = (user) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
    expiresIn: JWT_ACCESS_EXPIRY
  };
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'fusion',
      audience: 'fusion-client'
    });
    
    if (decoded.type !== 'access') {
      throw new AuthenticationError('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid token');
    }
    throw error;
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'fusion',
      audience: 'fusion-client'
    });
    
    if (decoded.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Refresh token expired. Please login again.');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid refresh token');
    }
    throw error;
  }
};

// ------------------------------------
// Authentication Flow
// ------------------------------------

/**
 * Complete authentication flow
 * 1. Verify nonce
 * 2. Verify signature
 * 3. Find or create user
 * 4. Generate tokens
 */
export const authenticate = async (walletAddress, signature, message, nonce) => {
  // Step 1: Verify nonce
  await verifyNonce(walletAddress, nonce);
  
  // Step 2: Verify signature
  await verifySignature(walletAddress, signature, message);
  
  // Step 3: Find or create user
  let user = await User.findOne({ walletAddress });
  
  if (!user) {
    user = await User.create({
      walletAddress,
      lastLogin: new Date()
    });
    log.info(`New user created: ${walletAddress.slice(0, 8)}...`);
  } else {
    user.lastLogin = new Date();
    await user.save();
    log.info(`User logged in: ${walletAddress.slice(0, 8)}...`);
  }
  
  // Step 4: Generate tokens
  const tokens = generateTokens(user);
  
  return {
    user: {
      id: user._id,
      walletAddress: user.walletAddress,
      preferences: user.preferences,
      autoTradeSettings: user.autoTradeSettings,
      tradingWalletsCount: user.tradingWallets.length,
      createdAt: user.createdAt
    },
    ...tokens
  };
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (refreshToken) => {
  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);
  
  // Check if user still exists
  const user = await User.findById(decoded.userId);
  
  if (!user) {
    throw new AuthenticationError('User not found');
  }
  
  if (!user.isActive) {
    throw new AuthenticationError('User account is deactivated');
  }
  
  // Generate new access token
  const accessToken = generateAccessToken(user);
  
  log.debug(`Token refreshed for user: ${user.walletAddress.slice(0, 8)}...`);
  
  return {
    accessToken,
    expiresIn: JWT_ACCESS_EXPIRY
  };
};

/**
 * Logout - invalidate refresh token
 */
export const logout = async (userId, refreshToken) => {
  // Add refresh token to blacklist
  const cacheKey = `blacklist:${refreshToken}`;
  
  // Get token expiry
  try {
    const decoded = jwt.decode(refreshToken);
    const expirySeconds = decoded.exp - Math.floor(Date.now() / 1000);
    
    if (expirySeconds > 0) {
      await cache.set(cacheKey, 'true', expirySeconds);
    }
  } catch {
    // Token already invalid, no need to blacklist
  }
  
  log.debug(`User logged out: ${userId}`);
  
  return true;
};

/**
 * Check if refresh token is blacklisted
 */
export const isTokenBlacklisted = async (token) => {
  const cacheKey = `blacklist:${token}`;
  const exists = await cache.exists(cacheKey);
  return exists === 1;
};

// ------------------------------------
// User Session Management
// ------------------------------------

/**
 * Get current user from token
 */
export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).select('-tradingWallets.encryptedPrivateKey');
  
  if (!user) {
    throw new AuthenticationError('User not found');
  }
  
  return user;
};

/**
 * Validate wallet ownership (for sensitive operations)
 */
export const validateWalletOwnership = async (userId, walletAddress) => {
  const user = await User.findById(userId);
  
  if (!user) {
    throw new AuthenticationError('User not found');
  }
  
  if (user.walletAddress !== walletAddress) {
    throw new AuthenticationError('Wallet address mismatch');
  }
  
  return true;
};

export default {
  generateNonce,
  verifySignature,
  authenticate,
  refreshAccessToken,
  logout,
  verifyAccessToken,
  verifyRefreshToken,
  getCurrentUser,
  validateWalletOwnership,
  isTokenBlacklisted,
  generateTokens
};
