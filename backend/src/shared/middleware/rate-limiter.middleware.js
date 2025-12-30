// ===========================================
// Fusion - Rate Limiter Middleware
// ===========================================

import rateLimit from 'express-rate-limit';
import { RateLimitError } from './error-handler.middleware.js';
import { logger } from '../utils/logger.js';
import { getRedisClient } from '../../config/redis.js';

// ------------------------------------
// Rate Limit Configuration
// ------------------------------------

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000; // 1 minute
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const TRADE_MAX_REQUESTS = parseInt(process.env.TRADE_RATE_LIMIT_MAX) || 10;

// ------------------------------------
// Custom Key Generator
// ------------------------------------

const keyGenerator = (req) => {
  // Use wallet address if authenticated, otherwise IP
  return req.user?.walletAddress || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         req.ip || 
         'unknown';
};

// ------------------------------------
// Rate Limit Exceeded Handler
// ------------------------------------

const limitHandler = (req, res, next, options) => {
  logger.warn('Rate limit exceeded:', {
    key: keyGenerator(req),
    path: req.path,
    method: req.method
  });

  throw new RateLimitError(
    `Too many requests. Please try again in ${Math.ceil(options.windowMs / 1000)} seconds.`
  );
};

// ------------------------------------
// Skip Function (for trusted clients)
// ------------------------------------

const skipFunction = (req) => {
  // Skip rate limiting for health checks
  if (req.path === '/health' || req.path === '/api/health') {
    return true;
  }
  return false;
};

// ------------------------------------
// General API Rate Limiter
// ------------------------------------

export const generalLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  keyGenerator,
  handler: limitHandler,
  skip: skipFunction,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests'
    }
  }
});

// ------------------------------------
// Trading Rate Limiter (Stricter)
// ------------------------------------

export const tradingLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: TRADE_MAX_REQUESTS,
  keyGenerator,
  handler: (req, res, next, options) => {
    logger.warn('Trading rate limit exceeded:', {
      key: keyGenerator(req),
      path: req.path
    });
    throw new RateLimitError('Trading rate limit exceeded. Maximum 10 trades per minute.');
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ------------------------------------
// Auth Rate Limiter (Prevent Brute Force)
// ------------------------------------

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  keyGenerator: (req) => {
    return req.body?.publicKey || req.ip || 'unknown';
  },
  handler: (req, res, next, options) => {
    logger.warn('Auth rate limit exceeded:', {
      key: req.body?.publicKey || req.ip
    });
    throw new RateLimitError('Too many authentication attempts. Please try again later.');
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ------------------------------------
// Volume Bot Rate Limiter
// ------------------------------------

export const volumeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 session creations per hour
  keyGenerator,
  handler: (req, res, next, options) => {
    throw new RateLimitError('Volume bot session limit exceeded. Maximum 5 sessions per hour.');
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ------------------------------------
// WebSocket Rate Limiter (Custom)
// ------------------------------------

const wsRateLimits = new Map();

export const wsRateLimiter = {
  /**
   * Check if WebSocket connection is allowed
   */
  isAllowed: (clientId, maxConnections = 5, windowMs = 60000) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    let connections = wsRateLimits.get(clientId) || [];
    connections = connections.filter(t => t > windowStart);
    
    if (connections.length >= maxConnections) {
      return false;
    }
    
    connections.push(now);
    wsRateLimits.set(clientId, connections);
    
    return true;
  },

  /**
   * Clean up old entries
   */
  cleanup: () => {
    const now = Date.now();
    const windowMs = 60000;
    
    for (const [clientId, connections] of wsRateLimits.entries()) {
      const valid = connections.filter(t => t > now - windowMs);
      if (valid.length === 0) {
        wsRateLimits.delete(clientId);
      } else {
        wsRateLimits.set(clientId, valid);
      }
    }
  }
};

// Cleanup WebSocket rate limits every minute
setInterval(() => wsRateLimiter.cleanup(), 60000);

// ------------------------------------
// Redis-based Rate Limiter (for distributed)
// ------------------------------------

export const createRedisRateLimiter = (options = {}) => {
  const {
    prefix = 'rl:',
    windowMs = 60000,
    maxRequests = 100
  } = options;

  return async (req, res, next) => {
    try {
      const redis = getRedisClient();
      const key = `${prefix}${keyGenerator(req)}`;
      
      const current = await redis.incr(key);
      
      if (current === 1) {
        await redis.pexpire(key, windowMs);
      }
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
      
      if (current > maxRequests) {
        const ttl = await redis.pttl(key);
        res.setHeader('X-RateLimit-Reset', Date.now() + ttl);
        
        throw new RateLimitError(
          `Rate limit exceeded. Try again in ${Math.ceil(ttl / 1000)} seconds.`
        );
      }
      
      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      // If Redis fails, allow the request (fail open)
      logger.warn('Redis rate limiter error, allowing request:', error.message);
      next();
    }
  };
};

// ------------------------------------
// Sliding Window Rate Limiter
// ------------------------------------

export const slidingWindowLimiter = (options = {}) => {
  const {
    windowMs = 60000,
    maxRequests = 100,
    prefix = 'sw:'
  } = options;

  const windows = new Map();

  return (req, res, next) => {
    const key = `${prefix}${keyGenerator(req)}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let requestTimes = windows.get(key) || [];
    requestTimes = requestTimes.filter(t => t > windowStart);

    if (requestTimes.length >= maxRequests) {
      const oldestRequest = requestTimes[0];
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
      
      res.setHeader('Retry-After', retryAfter);
      throw new RateLimitError(`Rate limit exceeded. Try again in ${retryAfter} seconds.`);
    }

    requestTimes.push(now);
    windows.set(key, requestTimes);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - requestTimes.length);

    next();
  };
};

export default {
  generalLimiter,
  tradingLimiter,
  authLimiter,
  volumeLimiter,
  wsRateLimiter,
  createRedisRateLimiter,
  slidingWindowLimiter
};
