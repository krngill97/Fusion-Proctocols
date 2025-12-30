/**
 * Token Creation Service
 * Creates real SPL tokens on Solana blockchain
 */

import {
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createSetAuthorityInstruction,
  AuthorityType,
} from '@solana/spl-token';
import solanaConnection from './solana-connection.js';

class TokenCreationService {
  /**
   * Create a new SPL token on Solana
   * @param {Object} params
   * @param {string} params.name - Token name
   * @param {string} params.symbol - Token symbol
   * @param {string} params.description - Token description
   * @param {string} params.imageUrl - Token image URL
   * @param {number} params.initialSupply - Initial supply (in tokens, not lamports)
   * @param {number} params.decimals - Token decimals (default 9)
   * @param {Keypair} params.payer - Payer keypair
   * @param {string} params.network - Network (devnet/mainnet)
   * @returns {Object} Token details including mint address
   */
  async createToken({
    name,
    symbol,
    description,
    imageUrl,
    initialSupply,
    decimals = 9,
    payer,
    network = 'devnet',
  }) {
    const connection = solanaConnection.getConnection(network);

    // Generate new mint keypair
    const mintKeypair = Keypair.generate();
    const mintPublicKey = mintKeypair.publicKey;

    console.log(`[Token Creation] Creating token: ${name} (${symbol})`);
    console.log(`[Token Creation] Mint address: ${mintPublicKey.toBase58()}`);

    // Get rent exemption amount
    const lamports = await getMinimumBalanceForRentExemptMint(connection);

    // Get associated token account for initial supply
    const payerTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      payer.publicKey
    );

    // Create transaction
    const transaction = new Transaction();

    // 1. Create mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintPublicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      })
    );

    // 2. Initialize mint
    transaction.add(
      createInitializeMintInstruction(
        mintPublicKey,
        decimals,
        payer.publicKey, // Mint authority
        payer.publicKey, // Freeze authority
        TOKEN_PROGRAM_ID
      )
    );

    // 3. Create associated token account for creator
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        payerTokenAccount,
        payer.publicKey,
        mintPublicKey
      )
    );

    // 4. Mint initial supply to creator
    if (initialSupply > 0) {
      const amount = BigInt(Math.floor(initialSupply * Math.pow(10, decimals)));
      transaction.add(
        createMintToInstruction(
          mintPublicKey,
          payerTokenAccount,
          payer.publicKey,
          amount
        )
      );
    }

    // 5. Optionally revoke mint authority (for fixed supply)
    // Uncomment if you want fixed supply tokens
    // transaction.add(
    //   createSetAuthorityInstruction(
    //     mintPublicKey,
    //     payer.publicKey,
    //     AuthorityType.MintTokens,
    //     null
    //   )
    // );

    // Send transaction
    console.log('[Token Creation] Sending transaction...');
    const signature = await connection.sendTransaction(
      transaction,
      [payer, mintKeypair],
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );

    console.log('[Token Creation] Transaction sent:', signature);

    // Wait for confirmation
    await solanaConnection.confirmTransaction(signature, network);

    console.log('[Token Creation] Transaction confirmed!');

    const tokenData = {
      mint: mintPublicKey.toBase58(),
      name,
      symbol,
      description,
      imageUrl,
      decimals,
      initialSupply,
      creator: payer.publicKey.toBase58(),
      creatorTokenAccount: payerTokenAccount.toBase58(),
      signature,
      network,
      solscanUrl: solanaConnection.getTokenSolscanUrl(mintPublicKey.toBase58(), network),
      transactionUrl: solanaConnection.getSolscanUrl(signature, network),
      timestamp: new Date(),
    };

    return tokenData;
  }

  /**
   * Get token metadata
   */
  async getTokenMetadata(mintAddress, network = 'devnet') {
    const connection = solanaConnection.getConnection(network);
    const mintPublicKey = new PublicKey(mintAddress);

    try {
      const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);

      if (!mintInfo.value) {
        throw new Error('Token mint not found');
      }

      const data = mintInfo.value.data.parsed.info;

      return {
        mint: mintAddress,
        decimals: data.decimals,
        supply: data.supply,
        mintAuthority: data.mintAuthority,
        freezeAuthority: data.freezeAuthority,
        isInitialized: data.isInitialized,
      };
    } catch (error) {
      console.error('[Token Creation] Error fetching metadata:', error);
      throw error;
    }
  }

  /**
   * Get token balance for a wallet
   */
  async getTokenBalance(mintAddress, walletAddress, network = 'devnet') {
    const connection = solanaConnection.getConnection(network);
    const mintPublicKey = new PublicKey(mintAddress);
    const walletPublicKey = new PublicKey(walletAddress);

    try {
      const tokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        walletPublicKey
      );

      const balance = await connection.getTokenAccountBalance(tokenAccount);
      return {
        balance: balance.value.uiAmount,
        decimals: balance.value.decimals,
        amount: balance.value.amount,
      };
    } catch (error) {
      // Account doesn't exist yet
      return {
        balance: 0,
        decimals: 9,
        amount: '0',
      };
    }
  }

  /**
   * Get all token holders
   */
  async getTokenHolders(mintAddress, network = 'devnet') {
    const connection = solanaConnection.getConnection(network);
    const mintPublicKey = new PublicKey(mintAddress);

    try {
      const accounts = await connection.getTokenLargestAccounts(mintPublicKey);

      const holders = await Promise.all(
        accounts.value.map(async (account) => {
          const accountInfo = await connection.getParsedAccountInfo(account.address);
          const owner = accountInfo.value?.data.parsed.info.owner;

          return {
            address: account.address.toBase58(),
            owner,
            balance: account.uiAmount,
            amount: account.amount,
          };
        })
      );

      return holders;
    } catch (error) {
      console.error('[Token Creation] Error fetching holders:', error);
      throw error;
    }
  }

  /**
   * Create token metadata (for Metaplex)
   * Note: This requires additional Metaplex dependencies
   * For now, we'll store metadata off-chain or in MongoDB
   */
  async createMetadata(tokenData) {
    // This would integrate with Metaplex Token Metadata program
    // For MVP, we'll just return the data structure
    return {
      name: tokenData.name,
      symbol: tokenData.symbol,
      description: tokenData.description,
      image: tokenData.imageUrl,
      attributes: [],
      properties: {
        files: [
          {
            uri: tokenData.imageUrl,
            type: 'image/png',
          },
        ],
        category: 'image',
      },
    };
  }
}

export default new TokenCreationService();
