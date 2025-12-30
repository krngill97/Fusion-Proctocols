// ===========================================
// Fusion - Helper Utilities
// ===========================================

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import crypto from 'crypto';

// ------------------------------------
// Solana Helpers
// ------------------------------------

/**
 * Validate Solana public key
 */
export const isValidPublicKey = (address) => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

/**
 * Convert lamports to SOL
 */
export const lamportsToSol = (lamports) => {
  return lamports / LAMPORTS_PER_SOL;
};

/**
 * Convert SOL to lamports
 */
export const solToLamports = (sol) => {
  return Math.floor(sol * LAMPORTS_PER_SOL);
};

/**
 * Shorten address for display
 */
export const shortenAddress = (address, chars = 4) => {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

/**
 * Format SOL amount
 */
export const formatSol = (amount, decimals = 4) => {
  return Number(amount).toFixed(decimals);
};

/**
 * Format token amount with decimals
 */
export const formatTokenAmount = (amount, decimals, displayDecimals = 4) => {
  const adjusted = amount / Math.pow(10, decimals);
  return Number(adjusted).toFixed(displayDecimals);
};

/**
 * Parse base58 private key to Uint8Array
 */
export const parsePrivateKey = (privateKeyString) => {
  try {
    return bs58.decode(privateKeyString);
  } catch {
    // Try as JSON array
    try {
      const parsed = JSON.parse(privateKeyString);
      return Uint8Array.from(parsed);
    } catch {
      throw new Error('Invalid private key format');
    }
  }
};

// ------------------------------------
// Encryption Helpers
// ------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt data using AES-256-GCM
 */
export const encrypt = (text, encryptionKey) => {
  const key = Buffer.from(encryptionKey, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return IV + AuthTag + Encrypted data
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
};

/**
 * Decrypt data using AES-256-GCM
 */
export const decrypt = (encryptedData, encryptionKey) => {
  const key = Buffer.from(encryptionKey, 'hex');
  
  // Extract IV, AuthTag, and encrypted text
  const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex');
  const authTag = Buffer.from(encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2), 'hex');
  const encrypted = encryptedData.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

/**
 * Generate random encryption key
 */
export const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

// ------------------------------------
// Time Helpers
// ------------------------------------

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generate random number between min and max
 */
export const generateRandomAmount = (min, max) => {
  return Math.random() * (max - min) + min;
};

/**
 * Generate random integer between min and max (inclusive)
 */
export const generateRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Get timestamp in seconds
 */
export const nowInSeconds = () => {
  return Math.floor(Date.now() / 1000);
};

/**
 * Format timestamp to ISO string
 */
export const formatTimestamp = (timestamp) => {
  return new Date(timestamp).toISOString();
};

/**
 * Calculate time ago string
 */
export const timeAgo = (timestamp) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

// ------------------------------------
// Data Helpers
// ------------------------------------

/**
 * Safely parse JSON
 */
export const safeJsonParse = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

/**
 * Remove duplicates from array by key
 */
export const uniqueBy = (array, key) => {
  const seen = new Set();
  return array.filter(item => {
    const value = typeof key === 'function' ? key(item) : item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

/**
 * Chunk array into smaller arrays
 */
export const chunk = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Retry function with exponential backoff
 */
export const retry = async (fn, maxAttempts = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
};

/**
 * Generate unique ID
 */
export const generateId = () => {
  return crypto.randomBytes(16).toString('hex');
};

// ------------------------------------
// Validation Helpers
// ------------------------------------

/**
 * Check if value is empty
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Clamp number between min and max
 */
export const clamp = (num, min, max) => {
  return Math.min(Math.max(num, min), max);
};

// ------------------------------------
// Rate Limiting Helpers
// ------------------------------------

/**
 * Simple in-memory rate limiter
 */
export class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get or create request timestamps for this key
    let timestamps = this.requests.get(key) || [];
    
    // Remove old timestamps
    timestamps = timestamps.filter(t => t > windowStart);
    
    // Check if under limit
    if (timestamps.length >= this.maxRequests) {
      return false;
    }
    
    // Add current timestamp
    timestamps.push(now);
    this.requests.set(key, timestamps);
    
    return true;
  }

  getRemainingRequests(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.requests.get(key) || []).filter(t => t > windowStart);
    return Math.max(0, this.maxRequests - timestamps.length);
  }

  reset(key) {
    this.requests.delete(key);
  }

  clear() {
    this.requests.clear();
  }
}

export default {
  isValidPublicKey,
  lamportsToSol,
  solToLamports,
  shortenAddress,
  formatSol,
  formatTokenAmount,
  parsePrivateKey,
  encrypt,
  decrypt,
  generateEncryptionKey,
  sleep,
  nowInSeconds,
  formatTimestamp,
  timeAgo,
  safeJsonParse,
  uniqueBy,
  chunk,
  retry,
  generateId,
  isEmpty,
  isValidEmail,
  clamp,
  RateLimiter
};
