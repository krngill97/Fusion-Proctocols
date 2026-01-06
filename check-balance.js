const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58 = require('bs58');

const privateKey = '3zjmRsxFWahhJZAkU8k661JPf9E21ipXHEDrZJeDVjdj9cKecwYmSLaN4ezXXCAzkzjfoGi9oSCVKCusWPgrqGrX';
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

async function checkBalance() {
  try {
    const decoded = bs58.default ? bs58.default.decode(privateKey) : bs58.decode(privateKey);
    const keypair = Keypair.fromSecretKey(decoded);
    const publicKey = keypair.publicKey.toBase58();

    console.log('Public Key:', publicKey);

    const balance = await connection.getBalance(keypair.publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;

    console.log('Balance:', balanceSOL, 'SOL');

    return { publicKey, balance: balanceSOL };
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkBalance();
