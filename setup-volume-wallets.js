const { Connection, Keypair, LAMPORTS_PER_SOL, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

async function airdrop(publicKey, amount = 2) {
  try {
    console.log(`Requesting ${amount} SOL airdrop for ${publicKey.toString()}...`);
    const signature = await connection.requestAirdrop(publicKey, amount * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);
    console.log(`✅ Airdropped ${amount} SOL to ${publicKey.toString()}`);
    return true;
  } catch (error) {
    console.error(`❌ Airdrop failed: ${error.message}`);
    return false;
  }
}

async function setupVolumeWallets() {
  console.log('🚀 Setting up 20 volume bot wallets...\n');

  const wallets = [];

  // Generate 20 wallets
  for (let i = 0; i < 20; i++) {
    const keypair = Keypair.generate();
    wallets.push({
      publicKey: keypair.publicKey.toString(),
      secretKey: Array.from(keypair.secretKey)
    });
    console.log(`Generated wallet ${i + 1}: ${keypair.publicKey.toString()}`);
  }

  // Save wallets to file
  fs.writeFileSync('volume-wallets.json', JSON.stringify(wallets, null, 2));
  console.log('\n💾 Saved wallets to volume-wallets.json\n');

  // Airdrop SOL to each wallet
  console.log('💰 Starting SOL airdrops...\n');
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const keypair = Keypair.fromSecretKey(new Uint8Array(wallet.secretKey));

    console.log(`[${i + 1}/20] Airdropping to wallet ${i + 1}...`);
    await airdrop(keypair.publicKey, 2);

    // Wait to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✅ All wallets created and funded!');
  console.log('\nWallet Summary:');
  wallets.forEach((wallet, i) => {
    console.log(`Wallet ${i + 1}: ${wallet.publicKey}`);
  });

  console.log('\n📝 Next step: Use these wallets in your volume bot configuration');
}

setupVolumeWallets().catch(console.error);
