// ===========================================
// Blockchain Monitor - Real Solana RPC Data
// ===========================================

import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../shared/utils/logger.js';

const log = logger.withContext('BlockchainMonitor');

class BlockchainMonitorService {
  constructor() {
    this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    this.cache = new Map();
    this.cacheTimeout = 10000; // 10 seconds
  }

  /**
   * Fetch real transactions for an address from Solana RPC
   */
  async getTransactions(address, limit = 100) {
    const cacheKey = `tx_${address}_${limit}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      log.info(`Fetching real transactions for ${address} from Solana RPC`);

      const pubkey = new PublicKey(address);

      // Fetch signatures
      const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit });

      // Fetch full transactions
      const transactions = [];
      for (const sig of signatures.slice(0, Math.min(limit, 50))) { // Limit to 50 for performance
        try {
          const tx = await this.connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          });

          if (tx) {
            const formatted = this.formatTransaction(tx, sig);
            transactions.push(formatted);
          }
        } catch (err) {
          log.warn(`Failed to fetch transaction ${sig.signature}: ${err.message}`);
        }
      }

      // Cache it
      this.cache.set(cacheKey, {
        data: transactions,
        timestamp: Date.now()
      });

      return transactions;

    } catch (error) {
      log.error(`Failed to fetch transactions: ${error.message}`);
      return [];
    }
  }

  /**
   * Format transaction to our standard format
   */
  formatTransaction(tx, sig) {
    const blockTime = tx.blockTime || sig.blockTime;
    const timestamp = blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString();

    // Extract SOL amounts from instructions
    let solAmount = 0;
    let tokenAmount = 0;
    let type = 'UNKNOWN';

    // Try to determine type from instructions
    if (tx.meta?.postBalances && tx.meta?.preBalances) {
      const balanceChange = tx.meta.postBalances[0] - tx.meta.preBalances[0];
      solAmount = Math.abs(balanceChange) / 1e9;
      type = balanceChange > 0 ? 'BUY' : 'SELL';
    }

    return {
      signature: sig.signature,
      timestamp,
      type,
      tokenAmount,
      solAmount,
      volumeSOL: solAmount,
      price: tokenAmount > 0 ? solAmount / tokenAmount : 0,
      wallet: tx.transaction?.message?.accountKeys?.[0]?.pubkey?.toString() || 'Unknown',
      status: tx.meta?.err ? 'failed' : 'confirmed',
      solscanUrl: `https://solscan.io/tx/${sig.signature}?cluster=devnet`,
      blockTime: blockTime,
      slot: sig.slot,
      fee: (tx.meta?.fee || 0) / 1e9
    };
  }

  /**
   * Get account balance
   */
  async getBalance(address) {
    try {
      const pubkey = new PublicKey(address);
      const balance = await this.connection.getBalance(pubkey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      log.error(`Failed to get balance: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get token account info
   */
  async getTokenAccountInfo(address) {
    try {
      const pubkey = new PublicKey(address);
      const info = await this.connection.getParsedAccountInfo(pubkey);
      return info.value?.data;
    } catch (error) {
      log.error(`Failed to get token account info: ${error.message}`);
      return null;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    log.info('Cache cleared');
  }
}

// Singleton instance
const blockchainMonitor = new BlockchainMonitorService();

export default blockchainMonitor;
