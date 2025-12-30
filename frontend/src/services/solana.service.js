/**
 * Solana Service - Real Blockchain Integration
 * Creates actual SPL tokens on Solana devnet
 */

import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
const MAINNET_ENDPOINT = 'https://api.mainnet-beta.solana.com';

class SolanaService {
  constructor() {
    this.connection = new Connection(DEVNET_ENDPOINT, 'confirmed');
    this.network = 'devnet';
  }

  /**
   * Switch network
   */
  setNetwork(network) {
    this.network = network;
    const endpoint = network === 'mainnet-beta' ? MAINNET_ENDPOINT : DEVNET_ENDPOINT;
    this.connection = new Connection(endpoint, 'confirmed');
  }

  /**
   * Get SOL balance
   */
  async getBalance(publicKey) {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Get balance error:', error);
      return 0;
    }
  }

  /**
   * Request airdrop (devnet only)
   */
  async requestAirdrop(publicKey, amount = 2) {
    if (this.network !== 'devnet') {
      throw new Error('Airdrops only available on devnet');
    }

    try {
      const signature = await this.connection.requestAirdrop(
        publicKey,
        amount * LAMPORTS_PER_SOL
      );

      // Wait for confirmation
      await this.connection.confirmTransaction(signature);

      return signature;
    } catch (error) {
      console.error('Airdrop error:', error);
      throw new Error('Airdrop failed. Try again in a minute or use https://faucet.solana.com');
    }
  }

  /**
   * Create SPL Token on blockchain
   */
  async createToken({
    name,
    symbol,
    decimals = 9,
    initialSupply,
    wallet, // Connected wallet from @solana/wallet-adapter
  }) {
    try {
      if (!wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      if (!wallet.signTransaction) {
        throw new Error('Wallet does not support signing');
      }

      console.log('Creating token with:', { name, symbol, decimals, initialSupply });

      // Generate new keypair for mint
      const mintKeypair = Keypair.generate();
      const mintPublicKey = mintKeypair.publicKey;

      console.log('Mint address:', mintPublicKey.toBase58());

      // Get associated token account address
      const associatedTokenAddress = getAssociatedTokenAddressSync(
        mintPublicKey,
        wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      console.log('Associated token account:', associatedTokenAddress.toBase58());

      // Get minimum balance for rent exemption
      const lamports = await getMinimumBalanceForRentExemptMint(this.connection);

      console.log('Required lamports:', lamports);

      // Create transaction
      const transaction = new Transaction();

      // 1. Create mint account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintPublicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // 2. Initialize mint
      transaction.add(
        createInitializeMint2Instruction(
          mintPublicKey,
          decimals,
          wallet.publicKey, // Mint authority
          wallet.publicKey, // Freeze authority
          TOKEN_PROGRAM_ID
        )
      );

      // 3. Create associated token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey, // Payer
          associatedTokenAddress, // Associated token account
          wallet.publicKey, // Owner
          mintPublicKey, // Mint
          TOKEN_PROGRAM_ID
        )
      );

      // 4. Mint initial supply
      if (initialSupply > 0) {
        const amount = BigInt(Math.floor(initialSupply * Math.pow(10, decimals)));

        transaction.add(
          createMintToInstruction(
            mintPublicKey,
            associatedTokenAddress,
            wallet.publicKey,
            amount,
            [],
            TOKEN_PROGRAM_ID
          )
        );

        console.log('Minting initial supply:', amount.toString());
      }

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Partially sign with mint keypair
      transaction.partialSign(mintKeypair);

      console.log('Requesting wallet signature...');

      // Sign with wallet
      const signedTransaction = await wallet.signTransaction(transaction);

      console.log('Sending transaction...');

      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        }
      );

      console.log('Transaction sent:', signature);

      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('Transaction confirmed!');

      return {
        mint: mintPublicKey.toBase58(),
        signature,
        associatedTokenAddress: associatedTokenAddress.toBase58(),
        name,
        symbol,
        decimals,
        initialSupply,
        creator: wallet.publicKey.toBase58(),
        network: this.network,
        solscanTokenUrl: this.getSolscanTokenUrl(mintPublicKey.toBase58()),
        solscanTxUrl: this.getSolscanTxUrl(signature),
      };

    } catch (error) {
      console.error('Create token error:', error);
      throw error;
    }
  }

  /**
   * Get Solscan token URL
   */
  getSolscanTokenUrl(mint) {
    const cluster = this.network === 'mainnet-beta' ? '' : `?cluster=${this.network}`;
    return `https://solscan.io/token/${mint}${cluster}`;
  }

  /**
   * Get Solscan transaction URL
   */
  getSolscanTxUrl(signature) {
    const cluster = this.network === 'mainnet-beta' ? '' : `?cluster=${this.network}`;
    return `https://solscan.io/tx/${signature}${cluster}`;
  }

  /**
   * Get token metadata from blockchain
   */
  async getTokenMetadata(mintAddress) {
    try {
      const mintPublicKey = new PublicKey(mintAddress);
      const mintInfo = await this.connection.getParsedAccountInfo(mintPublicKey);

      if (!mintInfo.value) {
        throw new Error('Token not found');
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
      console.error('Get token metadata error:', error);
      throw error;
    }
  }
}

export default new SolanaService();
