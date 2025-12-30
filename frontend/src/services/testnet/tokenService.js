/**
 * Testnet Token Service
 * Create and manage test tokens on Solana devnet
 */

import {
  Keypair,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  PublicKey
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

const TOKENS_STORAGE_KEY = 'testnet_tokens';
const TOKEN_METADATA_KEY = 'testnet_token_metadata';

/**
 * Generate token avatar (simple SVG)
 */
const generateTokenAvatar = (symbol) => {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#6366f1', '#f97316'
  ];

  const color = colors[Math.floor(Math.random() * colors.length)];
  const initial = symbol.charAt(0).toUpperCase();

  const svg = `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="${color}"/>
      <text x="50" y="50" font-family="Arial" font-size="48" fill="white"
            text-anchor="middle" dominant-baseline="central" font-weight="bold">
        ${initial}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Create a new token on devnet
 */
export const createToken = async (connection, wallet, tokenData) => {
  const {name, symbol, decimals = 9, supply, description = ''
  } = tokenData;

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  try {
    console.log('Creating token:', { name, symbol, decimals, supply });

    // Generate new mint keypair
    const mintKeypair = Keypair.generate();
    const mintAddress = mintKeypair.publicKey.toBase58();

    // Get rent-exempt balance for mint account
    const lamports = await getMinimumBalanceForRentExemptMint(connection);

    // Get associated token account address
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      wallet.publicKey
    );

    // Calculate supply with decimals
    const supplyWithDecimals = BigInt(supply) * BigInt(10 ** decimals);

    // Create transaction
    const transaction = new Transaction().add(
      // Create mint account
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      // Initialize mint
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        wallet.publicKey,
        wallet.publicKey
      ),
      // Create associated token account
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        associatedTokenAddress,
        wallet.publicKey,
        mintKeypair.publicKey
      ),
      // Mint tokens to creator
      createMintToInstruction(
        mintKeypair.publicKey,
        associatedTokenAddress,
        wallet.publicKey,
        supplyWithDecimals
      )
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign with mint keypair
    transaction.partialSign(mintKeypair);

    // Sign with wallet
    const signedTransaction = await wallet.signTransaction(transaction);

    // Send transaction
    console.log('Sending transaction...');
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());

    // Confirm transaction
    console.log('Confirming transaction...');
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    });

    console.log('Token created successfully!', mintAddress);

    // Create token metadata
    const token = {
      mint: mintAddress,
      name,
      symbol,
      decimals,
      supply: supply.toString(),
      description,
      image: generateTokenAvatar(symbol),
      creator: wallet.publicKey.toBase58(),
      createdAt: new Date().toISOString(),
      signature,

      // Testnet specific
      isTestnet: true,
      network: 'devnet',

      // Initial stats
      marketCap: 0,
      holders: 1,
      transactions: 1,
      volume24h: 0,

      // Bonding curve simulation
      bondingCurve: {
        virtualSolReserves: 30,
        virtualTokenReserves: parseInt(supply),
        realSolReserves: 0,
        realTokenReserves: parseInt(supply)
      }
    };

    // Save to localStorage
    saveToken(token);

    return {
      success: true,
      token,
      signature
    };

  } catch (error) {
    console.error('Token creation failed:', error);
    throw error;
  }
};

/**
 * Save token to localStorage
 */
export const saveToken = (token) => {
  try {
    const tokens = getTokens();
    tokens.unshift(token); // Add to beginning
    localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));

    // Also save detailed metadata separately
    const metadata = getTokenMetadata();
    metadata[token.mint] = token;
    localStorage.setItem(TOKEN_METADATA_KEY, JSON.stringify(metadata));

    console.log('Token saved to storage');
  } catch (error) {
    console.error('Failed to save token:', error);
  }
};

/**
 * Get all created tokens
 */
export const getTokens = () => {
  try {
    const data = localStorage.getItem(TOKENS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load tokens:', error);
    return [];
  }
};

/**
 * Get token by mint address
 */
export const getToken = (mintAddress) => {
  try {
    const metadata = getTokenMetadata();
    return metadata[mintAddress] || null;
  } catch (error) {
    console.error('Failed to get token:', error);
    return null;
  }
};

/**
 * Get all token metadata
 */
export const getTokenMetadata = () => {
  try {
    const data = localStorage.getItem(TOKEN_METADATA_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to load token metadata:', error);
    return {};
  }
};

/**
 * Update token stats
 */
export const updateTokenStats = (mintAddress, stats) => {
  try {
    const tokens = getTokens();
    const index = tokens.findIndex(t => t.mint === mintAddress);

    if (index !== -1) {
      tokens[index] = { ...tokens[index], ...stats };
      localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));

      // Update metadata
      const metadata = getTokenMetadata();
      metadata[mintAddress] = tokens[index];
      localStorage.setItem(TOKEN_METADATA_KEY, JSON.stringify(metadata));

      return tokens[index];
    }

    return null;
  } catch (error) {
    console.error('Failed to update token stats:', error);
    return null;
  }
};

/**
 * Delete token from storage
 */
export const deleteToken = (mintAddress) => {
  try {
    const tokens = getTokens();
    const filtered = tokens.filter(t => t.mint !== mintAddress);
    localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(filtered));

    const metadata = getTokenMetadata();
    delete metadata[mintAddress];
    localStorage.setItem(TOKEN_METADATA_KEY, JSON.stringify(metadata));

    console.log('Token deleted from storage');
    return true;
  } catch (error) {
    console.error('Failed to delete token:', error);
    return false;
  }
};

/**
 * Clear all tokens
 */
export const clearAllTokens = () => {
  try {
    localStorage.removeItem(TOKENS_STORAGE_KEY);
    localStorage.removeItem(TOKEN_METADATA_KEY);
    console.log('All tokens cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear tokens:', error);
    return false;
  }
};

/**
 * Get tokens created by specific wallet
 */
export const getTokensByCreator = (creatorAddress) => {
  const tokens = getTokens();
  return tokens.filter(t => t.creator === creatorAddress);
};

/**
 * Search tokens
 */
export const searchTokens = (query) => {
  const tokens = getTokens();
  const lowerQuery = query.toLowerCase();

  return tokens.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.symbol.toLowerCase().includes(lowerQuery) ||
    t.mint.toLowerCase().includes(lowerQuery)
  );
};

export default {
  createToken,
  saveToken,
  getTokens,
  getToken,
  getTokenMetadata,
  updateTokenStats,
  deleteToken,
  clearAllTokens,
  getTokensByCreator,
  searchTokens
};
