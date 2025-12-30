// ===========================================
// Fusion - Authentication Middleware
// ===========================================

import { verifyAccessToken, isTokenBlacklisted, getCurrentUser } from '../../modules/auth/auth.service.js';
import { AuthenticationError, AuthorizationError } from './error-handler.middleware.js';
import { logger } from '../utils/logger.js';

const log = logger.withContext('AuthMiddleware');

// ------------------------------------
// Extract Token from Header
// ------------------------------------

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  // Support "Bearer <token>" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  return authHeader;
};

// ------------------------------------
// Authentication Middleware
// ------------------------------------

/**
 * Require authentication
 * Adds req.user with user data if authenticated
 */
export const authenticate = async (req, res, next) => {
  try {
    // DEMO MODE: Create dummy user for testing
    const DEMO_MODE = process.env.DEMO_MODE === 'true';

    if (DEMO_MODE) {
      const User = (await import('../../modules/auth/auth.model.js')).default;
      const { Keypair } = await import('@solana/web3.js');
      const { encrypt } = await import('../../shared/services/encryption.service.js');

      // Use a valid-format demo wallet address (base58 encoded, looks like real Solana address)
      const DEMO_WALLET = 'DemoWa11etAddress1111111111111111111111111';

      // Try to find or create a demo user
      let demoUser = await User.findOne({ walletAddress: DEMO_WALLET });

      if (!demoUser) {
        // Generate a demo trading wallet
        const demoKeypair = Keypair.generate();
        const demoWalletPublicKey = demoKeypair.publicKey.toBase58();
        const demoWalletSecretKey = Buffer.from(demoKeypair.secretKey).toString('hex');

        // Encrypt the private key
        const encryptedPrivateKey = encrypt(demoWalletSecretKey, DEMO_WALLET);

        // Create demo user with trading wallet
        demoUser = await User.create({
          walletAddress: DEMO_WALLET,
          nonce: 'demo-nonce',
          isActive: true,
          tradingWallets: [{
            publicKey: demoWalletPublicKey,
            encryptedPrivateKey,
            label: 'Demo Trading Wallet',
            isDefault: true
          }]
        });
        log.info('Demo user created for DEMO_MODE with trading wallet: ' + demoWalletPublicKey);
      }

      req.user = {
        id: demoUser._id.toString(),
        walletAddress: demoUser.walletAddress,
        preferences: demoUser.preferences || {},
        autoTradeSettings: demoUser.autoTradeSettings || {},
        isActive: true
      };

      return next();
    }

    const token = extractToken(req);

    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    // Check if token is blacklisted
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      throw new AuthenticationError('Token has been revoked');
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from database
    const user = await getCurrentUser(decoded.userId);

    if (!user.isActive) {
      throw new AuthenticationError('User account is deactivated');
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      walletAddress: user.walletAddress,
      preferences: user.preferences,
      autoTradeSettings: user.autoTradeSettings,
      isActive: user.isActive
    };

    req.token = token;

    next();
  } catch (error) {
    next(error);
  }
};

// ------------------------------------
// Optional Authentication Middleware
// ------------------------------------

/**
 * Optional authentication
 * Adds req.user if authenticated, but doesn't fail if not
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      req.user = null;
      return next();
    }
    
    // Check if token is blacklisted
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      req.user = null;
      return next();
    }
    
    // Verify token
    const decoded = verifyAccessToken(token);
    
    // Get user from database
    const user = await getCurrentUser(decoded.userId);
    
    if (user && user.isActive) {
      req.user = {
        id: user._id.toString(),
        walletAddress: user.walletAddress,
        preferences: user.preferences,
        autoTradeSettings: user.autoTradeSettings,
        isActive: user.isActive
      };
      req.token = token;
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    // Don't fail, just set user to null
    req.user = null;
    next();
  }
};

// ------------------------------------
// Wallet Verification Middleware
// ------------------------------------

/**
 * Verify that the authenticated user owns the wallet in the request
 * Use after authenticate middleware
 */
export const verifyWalletOwnership = (walletParam = 'walletAddress') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }
      
      // Get wallet address from params, body, or query
      const walletAddress = 
        req.params[walletParam] || 
        req.body[walletParam] || 
        req.query[walletParam];
      
      if (!walletAddress) {
        return next(); // No wallet to verify
      }
      
      if (req.user.walletAddress !== walletAddress) {
        throw new AuthorizationError('You do not have permission to access this wallet');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// ------------------------------------
// Rate Limit by User Middleware
// ------------------------------------

/**
 * Custom rate limiter that uses user ID instead of IP
 */
export const userRateLimit = (options = {}) => {
  const {
    windowMs = 60000,
    maxRequests = 100,
    message = 'Too many requests'
  } = options;
  
  const requests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get existing requests for this user
    let userRequests = requests.get(userId) || [];
    
    // Filter to only requests in current window
    userRequests = userRequests.filter(time => time > windowStart);
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message
        }
      });
    }
    
    // Add current request
    userRequests.push(now);
    requests.set(userId, userRequests);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - userRequests.length);
    
    next();
  };
};

// ------------------------------------
// WebSocket Authentication
// ------------------------------------

/**
 * Authenticate WebSocket connection
 */
export const authenticateWebSocket = async (token) => {
  if (!token) {
    throw new AuthenticationError('No authentication token provided');
  }
  
  // Check if token is blacklisted
  const blacklisted = await isTokenBlacklisted(token);
  if (blacklisted) {
    throw new AuthenticationError('Token has been revoked');
  }
  
  // Verify token
  const decoded = verifyAccessToken(token);
  
  // Get user from database
  const user = await getCurrentUser(decoded.userId);
  
  if (!user.isActive) {
    throw new AuthenticationError('User account is deactivated');
  }
  
  return {
    id: user._id.toString(),
    walletAddress: user.walletAddress,
    preferences: user.preferences
  };
};

export default {
  authenticate,
  optionalAuth,
  verifyWalletOwnership,
  userRateLimit,
  authenticateWebSocket
};
