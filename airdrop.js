const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const publicKey = new PublicKey('AyzXLQu9X7tHwsoxd39D21Nd1XoS2aLbbTfJ3uwuZ7zn');

async function airdrop() {
  console.log('Requesting airdrops...');

  // Request 5 airdrops of 2 SOL each (max per request is usually 2 SOL)
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL)
        .then(signature => {
          console.log(`Airdrop ${i + 1} signature:`, signature);
          return connection.confirmTransaction(signature);
        })
    );
    // Wait a bit between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  await Promise.all(promises);

  const balance = await connection.getBalance(publicKey);
  console.log(`\nFinal balance: ${balance / LAMPORTS_PER_SOL} SOL`);
}

airdrop().catch(console.error);
