// Fusion Backend Environment Checker
// Run this from the backend directory: node check-env.js

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 FUSION BACKEND ENVIRONMENT CHECK\n');
console.log('=' .repeat(60));

// Load .env file
dotenv.config();

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function pass(message) {
  console.log('✅', message);
  checks.passed++;
}

function fail(message) {
  console.log('❌', message);
  checks.failed++;
}

function warn(message) {
  console.log('⚠️ ', message);
  checks.warnings++;
}

function section(title) {
  console.log('\n' + '─'.repeat(60));
  console.log(`📋 ${title}`);
  console.log('─'.repeat(60));
}

// 1. Check .env file exists
section('FILE CHECKS');
const envPath = join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  pass('.env file found');
} else {
  fail('.env file NOT found');
  console.log('   Expected location:', envPath);
}

// 2. Check required environment variables
section('ENVIRONMENT VARIABLES');

const required = {
  'NODE_ENV': { min: 1 },
  'PORT': { min: 1 },
  'MONGODB_URI': { min: 10 },
  'REDIS_URL': { min: 10 },
  'JWT_SECRET': { min: 64, type: 'secret' },
  'JWT_ACCESS_EXPIRY': { min: 1 },
  'JWT_REFRESH_EXPIRY': { min: 1 },
  'ENCRYPTION_KEY': { min: 32, type: 'secret' },
  'CHAINSTACK_RPC_HTTP': { min: 10 },
  'SOLANA_NETWORK': { min: 1 }
};

for (const [key, config] of Object.entries(required)) {
  const value = process.env[key];
  
  if (!value) {
    fail(`${key} is missing`);
  } else if (value.length < config.min) {
    fail(`${key} is too short (${value.length} chars, need ${config.min}+)`);
    if (config.type === 'secret') {
      console.log(`   Current length: ${value.length}`);
      console.log(`   Required length: ${config.min}+`);
    }
  } else {
    pass(`${key} is set (${value.length} chars)`);
  }
}

// 3. Check JWT_SECRET specifically
section('SECURITY CHECKS');
const jwtSecret = process.env.JWT_SECRET;
if (jwtSecret) {
  if (jwtSecret.length >= 64) {
    pass(`JWT_SECRET length: ${jwtSecret.length} chars ✓`);
  } else {
    fail(`JWT_SECRET is only ${jwtSecret.length} chars (need 64+)`);
    console.log('   Generate a new one with:');
    console.log('   node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  }
  
  if (jwtSecret.includes('1234567890abcdef')) {
    warn('JWT_SECRET appears to use a default/example value');
    console.log('   Consider generating a random secret for production');
  }
} else {
  fail('JWT_SECRET is not set');
}

const encryptionKey = process.env.ENCRYPTION_KEY;
if (encryptionKey) {
  if (encryptionKey.length >= 32) {
    pass(`ENCRYPTION_KEY length: ${encryptionKey.length} chars ✓`);
  } else {
    fail(`ENCRYPTION_KEY is only ${encryptionKey.length} chars (need 32+)`);
  }
} else {
  fail('ENCRYPTION_KEY is not set');
}

// 4. Check MongoDB URI format
section('DATABASE CHECKS');
const mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
  if (mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://')) {
    pass('MongoDB URI format looks correct');
    
    if (mongoUri.includes('1234') && mongoUri.includes('bscdoge')) {
      warn('MongoDB URI contains what looks like a default password');
      console.log('   Consider using a strong password for production');
    }
  } else {
    fail('MongoDB URI format is invalid');
  }
} else {
  fail('MONGODB_URI is not set');
}

// 5. Check Redis URL format
const redisUrl = process.env.REDIS_URL;
if (redisUrl) {
  if (redisUrl.startsWith('redis://')) {
    pass('Redis URL format looks correct');
  } else {
    fail('Redis URL format is invalid (should start with redis://)');
  }
} else {
  fail('REDIS_URL is not set');
}

// 6. Check Solana configuration
section('SOLANA CONFIGURATION');
const network = process.env.SOLANA_NETWORK;
if (network && ['mainnet-beta', 'devnet', 'testnet'].includes(network)) {
  pass(`Solana network: ${network}`);
} else if (network) {
  warn(`Unusual Solana network: ${network}`);
} else {
  fail('SOLANA_NETWORK is not set');
}

const rpcHttp = process.env.CHAINSTACK_RPC_HTTP;
if (rpcHttp) {
  if (rpcHttp.startsWith('http://') || rpcHttp.startsWith('https://')) {
    pass('Chainstack RPC HTTP URL looks correct');
  } else {
    fail('Chainstack RPC HTTP URL format is invalid');
  }
} else {
  fail('CHAINSTACK_RPC_HTTP is not set');
}

// 7. Summary
section('SUMMARY');
console.log(`✅ Passed:   ${checks.passed}`);
console.log(`❌ Failed:   ${checks.failed}`);
console.log(`⚠️  Warnings: ${checks.warnings}`);
console.log('');

if (checks.failed === 0) {
  console.log('🎉 All required checks passed!');
  console.log('   Your backend should be ready to start.');
  console.log('   Run: npm run dev');
  process.exit(0);
} else {
  console.log('❗ Some checks failed.');
  console.log('   Please fix the issues above before starting the backend.');
  process.exit(1);
}