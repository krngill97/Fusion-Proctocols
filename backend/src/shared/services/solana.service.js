// ===========================================
// Fusion - Solana Service
// ===========================================

import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  ComputeBudgetProgram
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';
import { getHttpConnection } from '../../config/chainstack.js';
import { cache } from '../../config/redis.js';
import { logger } from '../utils/logger.js';
import { lamportsToSol, retry } from '../utils/helpers.js';
import { PROGRAM_IDS } from '../../config/constants.js';

const log = logger.withContext('SolanaService');

// ------------------------------------
// Account Operations
// ------------------------------------

/**
 * Get SOL balance for a wallet
 */
export const getBalance = async (publicKey, useCache = true) => {
  const address = typeof publicKey === 'string' ? publicKey : publicKey.toBase58();
  const cacheKey = `balance:${address}`;

  // Check cache first
  if (useCache) {
    const cached = await cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  const connection = getHttpConnection();
  const balance = await connection.getBalance(new PublicKey(address));
  const solBalance = lamportsToSol(balance);

  // Cache for 30 seconds
  await cache.set(cacheKey, solBalance, 30);

  return solBalance;
};

/**
 * Get multiple wallet balances in one call
 */
export const getMultipleBalances = async (publicKeys) => {
  const connection = getHttpConnection();
  const keys = publicKeys.map(pk => 
    typeof pk === 'string' ? new PublicKey(pk) : pk
  );

  const accounts = await connection.getMultipleAccountsInfo(keys);
  
  return accounts.map((account, index) => ({
    address: keys[index].toBase58(),
    balance: account ? lamportsToSol(account.lamports) : 0
  }));
};

/**
 * Get token balance for a wallet
 */
export const getTokenBalance = async (walletAddress, tokenMint) => {
  const connection = getHttpConnection();
  const wallet = new PublicKey(walletAddress);
  const mint = new PublicKey(tokenMint);

  try {
    const ata = await getAssociatedTokenAddress(mint, wallet);
    const account = await getAccount(connection, ata);
    
    return {
      address: ata.toBase58(),
      amount: Number(account.amount),
      decimals: 0 // Need to fetch from mint for actual decimals
    };
  } catch (error) {
    // Account doesn't exist
    return {
      address: null,
      amount: 0,
      decimals: 0
    };
  }
};

/**
 * Get all token accounts for a wallet
 */
export const getTokenAccounts = async (walletAddress) => {
  const connection = getHttpConnection();
  const wallet = new PublicKey(walletAddress);

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    wallet,
    { programId: TOKEN_PROGRAM_ID }
  );

  return tokenAccounts.value.map(account => ({
    mint: account.account.data.parsed.info.mint,
    address: account.pubkey.toBase58(),
    amount: account.account.data.parsed.info.tokenAmount.uiAmount,
    decimals: account.account.data.parsed.info.tokenAmount.decimals,
    rawAmount: account.account.data.parsed.info.tokenAmount.amount
  }));
};

// ------------------------------------
// Token Metadata
// ------------------------------------

/**
 * Get token metadata
 */
export const getTokenMetadata = async (tokenMint, useCache = true) => {
  const cacheKey = `token:${tokenMint}`;

  // Check cache first
  if (useCache) {
    const cached = await cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  const connection = getHttpConnection();
  const mint = new PublicKey(tokenMint);

  try {
    // Get mint info
    const mintInfo = await connection.getParsedAccountInfo(mint);
    
    if (!mintInfo.value?.data?.parsed) {
      return null;
    }

    const { decimals, supply, mintAuthority, freezeAuthority } = 
      mintInfo.value.data.parsed.info;

    // Get metadata PDA
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        new PublicKey(PROGRAM_IDS.METAPLEX_METADATA).toBuffer(),
        mint.toBuffer()
      ],
      new PublicKey(PROGRAM_IDS.METAPLEX_METADATA)
    );

    let metadata = null;
    try {
      const metadataAccount = await connection.getAccountInfo(metadataPDA);
      if (metadataAccount) {
        // Parse metadata (simplified - full parsing requires borsh)
        metadata = {
          exists: true,
          address: metadataPDA.toBase58()
        };
      }
    } catch {
      // Metadata account doesn't exist
    }

    const result = {
      mint: tokenMint,
      decimals,
      supply: supply.toString(),
      mintAuthority: mintAuthority || null,
      freezeAuthority: freezeAuthority || null,
      metadata
    };

    // Cache for 1 hour
    await cache.set(cacheKey, result, 3600);

    return result;
  } catch (error) {
    log.error(`Failed to get token metadata: ${error.message}`);
    return null;
  }
};

// ------------------------------------
// Transaction Operations
// ------------------------------------

/**
 * Get recent transactions for a wallet
 */
export const getRecentTransactions = async (walletAddress, limit = 10) => {
  const connection = getHttpConnection();
  const wallet = new PublicKey(walletAddress);

  const signatures = await connection.getSignaturesForAddress(wallet, { limit });
  
  return signatures.map(sig => ({
    signature: sig.signature,
    slot: sig.slot,
    blockTime: sig.blockTime ? new Date(sig.blockTime * 1000) : null,
    err: sig.err,
    memo: sig.memo
  }));
};

/**
 * Get transaction details
 */
export const getTransactionDetails = async (signature) => {
  const connection = getHttpConnection();
  
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0
  });

  if (!tx) {
    return null;
  }

  return {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime ? new Date(tx.blockTime * 1000) : null,
    fee: lamportsToSol(tx.meta?.fee || 0),
    success: !tx.meta?.err,
    instructions: tx.transaction.message.instructions,
    preBalances: tx.meta?.preBalances,
    postBalances: tx.meta?.postBalances,
    preTokenBalances: tx.meta?.preTokenBalances,
    postTokenBalances: tx.meta?.postTokenBalances
  };
};

/**
 * Send SOL to another wallet
 */
export const sendSol = async (fromKeypair, toAddress, amountSol, priorityFee = 10000) => {
  const connection = getHttpConnection();
  const to = new PublicKey(toAddress);
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  const transaction = new Transaction();

  // Add priority fee
  if (priorityFee > 0) {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFee
      })
    );
  }

  // Add transfer instruction
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: to,
      lamports
    })
  );

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = 
    await connection.getLatestBlockhash('confirmed');
  
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromKeypair.publicKey;

  // Sign and send
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [fromKeypair],
    {
      commitment: 'confirmed',
      maxRetries: 3
    }
  );

  log.info(`SOL sent: ${amountSol} SOL to ${toAddress}, signature: ${signature}`);

  return {
    signature,
    amount: amountSol,
    to: toAddress,
    from: fromKeypair.publicKey.toBase58()
  };
};

// ------------------------------------
// Keypair Operations
// ------------------------------------

/**
 * Generate new keypair
 */
export const generateKeypair = () => {
  const keypair = Keypair.generate();
  
  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
    keypair
  };
};

/**
 * Import keypair from private key
 */
export const importKeypair = (privateKey) => {
  let secretKey;

  if (typeof privateKey === 'string') {
    try {
      // Try base58
      secretKey = bs58.decode(privateKey);
    } catch {
      // Try JSON array
      try {
        const parsed = JSON.parse(privateKey);
        secretKey = Uint8Array.from(parsed);
      } catch {
        throw new Error('Invalid private key format');
      }
    }
  } else if (Array.isArray(privateKey)) {
    secretKey = Uint8Array.from(privateKey);
  } else {
    secretKey = privateKey;
  }

  const keypair = Keypair.fromSecretKey(secretKey);

  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
    keypair
  };
};

// ------------------------------------
// Program Detection
// ------------------------------------

/**
 * Check if transaction involves pump.fun
 */
export const isPumpFunTransaction = (tx) => {
  if (!tx?.transaction?.message?.instructions) {
    return false;
  }

  return tx.transaction.message.instructions.some(ix => {
    const programId = ix.programId?.toBase58?.() || ix.programId;
    return programId === PROGRAM_IDS.PUMP_FUN;
  });
};

/**
 * Check if transaction involves Raydium
 */
export const isRaydiumTransaction = (tx) => {
  if (!tx?.transaction?.message?.instructions) {
    return false;
  }

  const raydiumPrograms = [
    PROGRAM_IDS.RAYDIUM_AMM,
    PROGRAM_IDS.RAYDIUM_CLMM,
    PROGRAM_IDS.RAYDIUM_CPMM
  ];

  return tx.transaction.message.instructions.some(ix => {
    const programId = ix.programId?.toBase58?.() || ix.programId;
    return raydiumPrograms.includes(programId);
  });
};

/**
 * Detect transaction type
 */
export const detectTransactionType = async (signature) => {
  const tx = await getTransactionDetails(signature);
  
  if (!tx) {
    return { type: 'unknown', tx: null };
  }

  const types = [];

  if (isPumpFunTransaction(tx)) {
    types.push('pump_fun');
  }

  if (isRaydiumTransaction(tx)) {
    types.push('raydium');
  }

  // Check for token transfers
  if (tx.preTokenBalances?.length || tx.postTokenBalances?.length) {
    types.push('token_transfer');
  }

  // Check for SOL transfers
  const hasSOLTransfer = tx.instructions?.some(ix => 
    ix.program === 'system' && ix.parsed?.type === 'transfer'
  );
  
  if (hasSOLTransfer) {
    types.push('sol_transfer');
  }

  return {
    type: types.length > 0 ? types : ['unknown'],
    tx
  };
};

// ------------------------------------
// Utility Functions
// ------------------------------------

/**
 * Wait for transaction confirmation
 */
export const confirmTransaction = async (signature, commitment = 'confirmed') => {
  const connection = getHttpConnection();

  return retry(async () => {
    const result = await connection.confirmTransaction(signature, commitment);
    
    if (result.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
    }

    return result;
  }, 3, 2000);
};

/**
 * Get current slot
 */
export const getCurrentSlot = async () => {
  const connection = getHttpConnection();
  return connection.getSlot();
};

/**
 * Get block time
 */
export const getBlockTime = async (slot) => {
  const connection = getHttpConnection();
  const blockTime = await connection.getBlockTime(slot);
  return blockTime ? new Date(blockTime * 1000) : null;
};

/**
 * Estimate transaction fee
 */
export const estimateFee = async (transaction) => {
  const connection = getHttpConnection();
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  const fee = await transaction.getEstimatedFee(connection);
  return lamportsToSol(fee || 5000);
};

export default {
  getBalance,
  getMultipleBalances,
  getTokenBalance,
  getTokenAccounts,
  getTokenMetadata,
  getRecentTransactions,
  getTransactionDetails,
  sendSol,
  generateKeypair,
  importKeypair,
  isPumpFunTransaction,
  isRaydiumTransaction,
  detectTransactionType,
  confirmTransaction,
  getCurrentSlot,
  getBlockTime,
  estimateFee
};
