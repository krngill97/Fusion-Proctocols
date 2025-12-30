// ===========================================
// Fusion - Encryption Service
// ===========================================

import crypto from 'crypto';
import { logger } from '../utils/logger.js';

const log = logger.withContext('EncryptionService');

// ------------------------------------
// Configuration
// ------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

// ------------------------------------
// Get Encryption Key
// ------------------------------------

const getMasterKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(key, 'hex');
};

// ------------------------------------
// Derive Key from Password
// ------------------------------------

/**
 * Derive encryption key from password and salt
 */
export const deriveKey = (password, salt) => {
  return crypto.pbkdf2Sync(
    password,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );
};

// ------------------------------------
// Encrypt Data
// ------------------------------------

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {string} [userSalt] - Optional additional salt (e.g., user's wallet signature)
 * @returns {string} Encrypted data as hex string
 */
export const encrypt = (plaintext, userSalt = '') => {
  try {
    const masterKey = getMasterKey();
    
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Generate random salt for this encryption
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Derive final key using master key + user salt + random salt
    const combinedSalt = Buffer.concat([salt, Buffer.from(userSalt)]);
    const derivedKey = deriveKey(masterKey, combinedSalt);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    
    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine: salt + iv + authTag + encrypted
    const result = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]).toString('hex');
    
    return result;
  } catch (error) {
    log.error('Encryption failed:', error.message);
    throw new Error('Failed to encrypt data');
  }
};

// ------------------------------------
// Decrypt Data
// ------------------------------------

/**
 * Decrypt data encrypted with AES-256-GCM
 * @param {string} encryptedData - Encrypted data as hex string
 * @param {string} [userSalt] - Optional additional salt used during encryption
 * @returns {string} Decrypted plaintext
 */
export const decrypt = (encryptedData, userSalt = '') => {
  try {
    const masterKey = getMasterKey();
    const data = Buffer.from(encryptedData, 'hex');
    
    // Extract components
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = data.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Derive key using same process
    const combinedSalt = Buffer.concat([salt, Buffer.from(userSalt)]);
    const derivedKey = deriveKey(masterKey, combinedSalt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    log.error('Decryption failed:', error.message);
    throw new Error('Failed to decrypt data');
  }
};

// ------------------------------------
// Encrypt Private Key
// ------------------------------------

/**
 * Encrypt a Solana private key
 * @param {string} privateKey - Base58 encoded private key
 * @param {string} walletAddress - User's wallet address (used as additional salt)
 * @returns {string} Encrypted private key
 */
export const encryptPrivateKey = (privateKey, walletAddress) => {
  if (!privateKey || !walletAddress) {
    throw new Error('Private key and wallet address are required');
  }

  return encrypt(privateKey, walletAddress);
};

// ------------------------------------
// Decrypt Private Key
// ------------------------------------

/**
 * Decrypt a Solana private key
 * @param {string} encryptedKey - Encrypted private key
 * @param {string} walletAddress - User's wallet address (used as additional salt)
 * @returns {string} Decrypted base58 private key
 */
export const decryptPrivateKey = (encryptedKey, walletAddress) => {
  if (!encryptedKey || !walletAddress) {
    throw new Error('Encrypted key and wallet address are required');
  }

  return decrypt(encryptedKey, walletAddress);
};

// ------------------------------------
// Hash Functions
// ------------------------------------

/**
 * Create SHA-256 hash
 */
export const sha256 = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Create SHA-512 hash
 */
export const sha512 = (data) => {
  return crypto.createHash('sha512').update(data).digest('hex');
};

/**
 * Create HMAC-SHA256
 */
export const hmacSha256 = (data, secret) => {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

// ------------------------------------
// Random Generation
// ------------------------------------

/**
 * Generate random hex string
 */
export const randomHex = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Generate random base64 string
 */
export const randomBase64 = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('base64');
};

/**
 * Generate random alphanumeric string
 */
export const randomAlphanumeric = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  
  return result;
};

// ------------------------------------
// Constant-Time Comparison
// ------------------------------------

/**
 * Constant-time string comparison (prevents timing attacks)
 */
export const secureCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
};

// ------------------------------------
// Key Validation
// ------------------------------------

/**
 * Validate that encryption key is properly configured
 */
export const validateEncryptionSetup = () => {
  try {
    getMasterKey();
    
    // Test encrypt/decrypt cycle
    const testData = 'test-encryption-' + Date.now();
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    
    if (testData !== decrypted) {
      throw new Error('Encryption/decryption test failed');
    }

    log.info('Encryption setup validated successfully');
    return true;
  } catch (error) {
    log.error('Encryption setup validation failed:', error.message);
    return false;
  }
};

// ------------------------------------
// Secure Memory Cleanup
// ------------------------------------

/**
 * Securely clear sensitive data from memory
 * Note: JavaScript doesn't guarantee immediate memory cleanup,
 * but this helps reduce the window of exposure
 */
export const secureClear = (buffer) => {
  if (Buffer.isBuffer(buffer)) {
    buffer.fill(0);
  } else if (typeof buffer === 'string') {
    // Strings are immutable in JS, can't clear them
    // Best practice: use Buffers for sensitive data
    return;
  } else if (Array.isArray(buffer)) {
    buffer.fill(0);
  }
};

export default {
  encrypt,
  decrypt,
  encryptPrivateKey,
  decryptPrivateKey,
  deriveKey,
  sha256,
  sha512,
  hmacSha256,
  randomHex,
  randomBase64,
  randomAlphanumeric,
  secureCompare,
  validateEncryptionSetup,
  secureClear
};
