/**
 * Testnet Wallet Service
 * Simplified wallet authentication without backend
 */

import bs58 from 'bs58';

const TESTNET_MODE = true;
const SESSION_KEY = 'testnet_session';

/**
 * Connect wallet and create testnet session
 */
export const connectTestnetWallet = async (publicKey, signMessage) => {
  if (!TESTNET_MODE) {
    throw new Error('Testnet mode is not enabled');
  }

  if (!publicKey || !signMessage) {
    throw new Error('Wallet not connected');
  }

  try {
    // Create challenge message
    const timestamp = Date.now();
    const message = `Welcome to FUSION Pro Testnet!\n\nSign this message to access the testing environment.\n\nTimestamp: ${timestamp}\nWallet: ${publicKey.toBase58()}`;

    console.log('Requesting signature for testnet session...');

    // Request signature
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = await signMessage(messageBytes);
    const signature = bs58.encode(signatureBytes);

    // Create session
    const session = {
      publicKey: publicKey.toBase58(),
      timestamp,
      signature,
      isTestnet: true,
      createdAt: new Date().toISOString()
    };

    // Store in localStorage
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    console.log('Testnet session created successfully');

    return {
      success: true,
      session
    };

  } catch (error) {
    console.error('Testnet wallet connection failed:', error);

    // Check if user rejected
    if (error.message?.includes('User rejected')) {
      throw new Error('Signature request was rejected');
    }

    throw new Error('Failed to connect wallet: ' + error.message);
  }
};

/**
 * Get current testnet session
 */
export const getTestnetSession = () => {
  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;

    const session = JSON.parse(sessionData);

    // Check if session is still valid (24 hours)
    const sessionAge = Date.now() - session.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxAge) {
      console.log('Testnet session expired');
      disconnectTestnetWallet();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error reading testnet session:', error);
    return null;
  }
};

/**
 * Check if user is authenticated in testnet
 */
export const isTestnetAuthenticated = () => {
  return getTestnetSession() !== null;
};

/**
 * Disconnect testnet wallet
 */
export const disconnectTestnetWallet = () => {
  localStorage.removeItem(SESSION_KEY);
  console.log('Testnet session cleared');
};

/**
 * Get wallet address from session
 */
export const getTestnetWalletAddress = () => {
  const session = getTestnetSession();
  return session?.publicKey || null;
};

export default {
  connectTestnetWallet,
  getTestnetSession,
  isTestnetAuthenticated,
  disconnectTestnetWallet,
  getTestnetWalletAddress
};
