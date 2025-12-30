/**
 * Trading Service
 * Executes real token swaps on Solana using Jupiter Aggregator or direct swaps
 */

import {
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import solanaConnection from './solana-connection.js';

// Jupiter API endpoint (for aggregated swaps)
const JUPITER_API = 'https://quote-api.jup.ag/v6';

class TradingService {
  /**
   * Get quote for a swap (Jupiter aggregator)
   */
  async getQuote({
    inputMint,
    outputMint,
    amount,
    slippageBps = 50, // 0.5%
    network = 'devnet',
  }) {
    try {
      // For devnet, we'll use a simple price calculation
      // Jupiter primarily works on mainnet
      if (network === 'devnet') {
        return this.getDevnetQuote({ inputMint, outputMint, amount, slippageBps });
      }

      // For mainnet, use Jupiter API
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
      });

      const response = await fetch(`${JUPITER_API}/quote?${params}`);
      const quote = await response.json();

      return {
        inputMint,
        outputMint,
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        otherAmountThreshold: quote.otherAmountThreshold,
        swapMode: quote.swapMode,
        slippageBps,
        priceImpactPct: quote.priceImpactPct,
        routePlan: quote.routePlan,
      };
    } catch (error) {
      console.error('[Trading] Error getting quote:', error);
      throw error;
    }
  }

  /**
   * Simple devnet quote (for testing)
   */
  getDevnetQuote({ inputMint, outputMint, amount, slippageBps }) {
    // Simple 1:1000 ratio for demo (1 SOL = 1000 tokens)
    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    let outAmount;
    if (inputMint === SOL_MINT) {
      // Buying tokens with SOL
      outAmount = BigInt(amount) * BigInt(1000);
    } else {
      // Selling tokens for SOL
      outAmount = BigInt(amount) / BigInt(1000);
    }

    const slippage = (BigInt(outAmount) * BigInt(slippageBps)) / BigInt(10000);
    const minOutAmount = BigInt(outAmount) - slippage;

    return {
      inputMint,
      outputMint,
      inAmount: amount.toString(),
      outAmount: outAmount.toString(),
      otherAmountThreshold: minOutAmount.toString(),
      swapMode: 'ExactIn',
      slippageBps,
      priceImpactPct: '0.1',
    };
  }

  /**
   * Execute a swap transaction
   */
  async executeSwap({
    quote,
    userPublicKey,
    userKeypair,
    network = 'devnet',
  }) {
    const connection = solanaConnection.getConnection(network);

    console.log('[Trading] Executing swap...');
    console.log('[Trading] Input:', quote.inputMint);
    console.log('[Trading] Output:', quote.outputMint);
    console.log('[Trading] Amount:', quote.inAmount);

    try {
      // For devnet, execute simple token transfer
      if (network === 'devnet') {
        return await this.executeDevnetSwap({
          quote,
          userKeypair,
          connection,
          network,
        });
      }

      // For mainnet, use Jupiter swap
      return await this.executeJupiterSwap({
        quote,
        userPublicKey,
        userKeypair,
        connection,
        network,
      });
    } catch (error) {
      console.error('[Trading] Swap execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute simple devnet swap (for testing)
   */
  async executeDevnetSwap({ quote, userKeypair, connection, network }) {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const transaction = new Transaction();

    if (quote.inputMint === SOL_MINT) {
      // Buying tokens with SOL
      // Transfer SOL to a dummy "pool" address
      const poolAddress = new PublicKey('11111111111111111111111111111111');

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userKeypair.publicKey,
          toPubkey: poolAddress,
          lamports: BigInt(quote.inAmount),
        })
      );
    } else {
      // Selling tokens for SOL
      const tokenMint = new PublicKey(quote.inputMint);
      const userTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        userKeypair.publicKey
      );

      // In real scenario, this would transfer to a liquidity pool
      // For demo, we simulate by burning tokens (transfer to program)
      transaction.add(
        createTransferInstruction(
          userTokenAccount,
          userTokenAccount, // Same account for demo
          userKeypair.publicKey,
          BigInt(quote.inAmount)
        )
      );
    }

    const signature = await connection.sendTransaction(
      transaction,
      [userKeypair],
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );

    await solanaConnection.confirmTransaction(signature, network);

    return {
      signature,
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      solscanUrl: solanaConnection.getSolscanUrl(signature, network),
      timestamp: new Date(),
    };
  }

  /**
   * Execute Jupiter swap (mainnet)
   */
  async executeJupiterSwap({ quote, userPublicKey, userKeypair, connection, network }) {
    // Get serialized transaction from Jupiter
    const response = await fetch(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: userPublicKey.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });

    const { swapTransaction } = await response.json();

    // Deserialize transaction
    const transactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = Transaction.from(transactionBuf);

    // Sign and send
    const signature = await connection.sendTransaction(
      transaction,
      [userKeypair],
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );

    await solanaConnection.confirmTransaction(signature, network);

    return {
      signature,
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      solscanUrl: solanaConnection.getSolscanUrl(signature, network),
      timestamp: new Date(),
    };
  }

  /**
   * Get trade history for a wallet
   */
  async getTradeHistory(walletAddress, network = 'devnet') {
    const publicKey = new PublicKey(walletAddress);
    const transactions = await solanaConnection.getRecentTransactions(
      publicKey,
      50,
      network
    );

    // Filter and parse swap transactions
    const trades = transactions
      .filter(tx => tx.transaction && !tx.err)
      .map(tx => ({
        signature: tx.signature,
        blockTime: tx.blockTime,
        slot: tx.slot,
        solscanUrl: solanaConnection.getSolscanUrl(tx.signature, network),
      }));

    return trades;
  }

  /**
   * Get token price (simple implementation)
   */
  async getTokenPrice(tokenMint, network = 'devnet') {
    // For devnet, return fixed demo price
    if (network === 'devnet') {
      return {
        mint: tokenMint,
        priceInSol: 0.001,
        priceInUsd: 0.1,
        volume24h: 1000,
        network,
      };
    }

    // For mainnet, integrate with price APIs (Birdeye, Jupiter, etc.)
    try {
      // TODO: Integrate with actual price API
      return {
        mint: tokenMint,
        priceInSol: 0,
        priceInUsd: 0,
        volume24h: 0,
        network,
      };
    } catch (error) {
      console.error('[Trading] Error fetching price:', error);
      throw error;
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateFees(network = 'devnet') {
    const connection = solanaConnection.getConnection(network);

    try {
      const { feeCalculator } = await connection.getRecentBlockhash();
      const baseFee = feeCalculator?.lamportsPerSignature || 5000;

      return {
        baseFee: baseFee / LAMPORTS_PER_SOL,
        priorityFee: 0.000005, // ~5000 lamports
        totalEstimate: (baseFee + 5000) / LAMPORTS_PER_SOL,
      };
    } catch (error) {
      // Fallback to typical fees
      return {
        baseFee: 0.000005,
        priorityFee: 0.000005,
        totalEstimate: 0.00001,
      };
    }
  }

  /**
   * Check if user has sufficient balance
   */
  async checkBalance({
    walletAddress,
    tokenMint,
    amount,
    network = 'devnet',
  }) {
    const publicKey = new PublicKey(walletAddress);
    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    if (tokenMint === SOL_MINT) {
      // Check SOL balance
      const balance = await solanaConnection.getBalance(publicKey, network);
      return {
        hasBalance: balance >= amount,
        balance,
        required: amount,
      };
    } else {
      // Check token balance
      const tokenBalance = await solanaConnection.getConnection(network)
        .getTokenAccountBalance(
          await getAssociatedTokenAddress(
            new PublicKey(tokenMint),
            publicKey
          )
        );

      return {
        hasBalance: BigInt(tokenBalance.value.amount) >= BigInt(amount),
        balance: tokenBalance.value.uiAmount,
        required: amount,
      };
    }
  }
}

export default new TradingService();
