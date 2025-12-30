/**
 * Solana Connection Service
 * Manages connections to Solana devnet/mainnet with connection pooling
 */

import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import bs58 from 'bs58';

class SolanaConnectionService {
  constructor() {
    this.connections = new Map();
    this.defaultNetwork = 'devnet';

    // RPC endpoints
    this.endpoints = {
      devnet: process.env.SOLANA_DEVNET_RPC || clusterApiUrl('devnet'),
      mainnet: process.env.SOLANA_MAINNET_RPC || clusterApiUrl('mainnet-beta'),
    };
  }

  /**
   * Get or create connection for a network
   */
  getConnection(network = 'devnet') {
    if (!this.connections.has(network)) {
      const endpoint = this.endpoints[network];
      if (!endpoint) {
        throw new Error(`Unknown network: ${network}`);
      }

      const connection = new Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });

      this.connections.set(network, connection);
      console.log(`[Solana] Created connection to ${network}: ${endpoint}`);
    }

    return this.connections.get(network);
  }

  /**
   * Create keypair from base58 private key
   */
  keypairFromPrivateKey(privateKey) {
    try {
      const decoded = bs58.decode(privateKey);
      return Keypair.fromSecretKey(decoded);
    } catch (error) {
      throw new Error(`Invalid private key format: ${error.message}`);
    }
  }

  /**
   * Get master wallet keypair from environment
   */
  getMasterWallet() {
    const privateKey = process.env.MASTER_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('MASTER_WALLET_PRIVATE_KEY not set in environment');
    }
    return this.keypairFromPrivateKey(privateKey);
  }

  /**
   * Get SOL balance for a wallet
   */
  async getBalance(publicKey, network = 'devnet') {
    const connection = this.getConnection(network);
    const balance = await connection.getBalance(publicKey);
    return balance / 1e9; // Convert lamports to SOL
  }

  /**
   * Request airdrop on devnet (for testing)
   */
  async requestAirdrop(publicKey, amount = 1, network = 'devnet') {
    if (network !== 'devnet') {
      throw new Error('Airdrops only available on devnet');
    }

    const connection = this.getConnection(network);
    const signature = await connection.requestAirdrop(
      publicKey,
      amount * 1e9 // Convert SOL to lamports
    );

    // Wait for confirmation
    await connection.confirmTransaction(signature);
    return signature;
  }

  /**
   * Get recent transactions for a wallet
   */
  async getRecentTransactions(publicKey, limit = 10, network = 'devnet') {
    const connection = this.getConnection(network);
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit });

    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        const tx = await connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });
        return {
          signature: sig.signature,
          slot: sig.slot,
          blockTime: sig.blockTime,
          err: sig.err,
          transaction: tx,
        };
      })
    );

    return transactions;
  }

  /**
   * Check if transaction is confirmed
   */
  async isTransactionConfirmed(signature, network = 'devnet') {
    const connection = this.getConnection(network);
    const status = await connection.getSignatureStatus(signature);
    return status.value?.confirmationStatus === 'confirmed' ||
           status.value?.confirmationStatus === 'finalized';
  }

  /**
   * Wait for transaction confirmation
   */
  async confirmTransaction(signature, network = 'devnet', timeout = 60000) {
    const connection = this.getConnection(network);
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await connection.getSignatureStatus(signature);

      if (status.value?.confirmationStatus === 'confirmed' ||
          status.value?.confirmationStatus === 'finalized') {
        return true;
      }

      if (status.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Transaction confirmation timeout');
  }

  /**
   * Get transaction details
   */
  async getTransaction(signature, network = 'devnet') {
    const connection = this.getConnection(network);
    return await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
  }

  /**
   * Get Solscan URL for transaction
   */
  getSolscanUrl(signature, network = 'devnet') {
    const cluster = network === 'mainnet' ? '' : `?cluster=${network}`;
    return `https://solscan.io/tx/${signature}${cluster}`;
  }

  /**
   * Get Solscan URL for token
   */
  getTokenSolscanUrl(mint, network = 'devnet') {
    const cluster = network === 'mainnet' ? '' : `?cluster=${network}`;
    return `https://solscan.io/token/${mint}${cluster}`;
  }

  /**
   * Get Solscan URL for wallet
   */
  getWalletSolscanUrl(publicKey, network = 'devnet') {
    const cluster = network === 'mainnet' ? '' : `?cluster=${network}`;
    return `https://solscan.io/account/${publicKey}${cluster}`;
  }
}

// Export singleton instance
export default new SolanaConnectionService();
