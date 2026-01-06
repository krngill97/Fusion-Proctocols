const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

const wallet = Keypair.generate();
const privateKeyArray = Array.from(wallet.secretKey);
const privateKeyBase58 = bs58.default ? bs58.default.encode(wallet.secretKey) : bs58.encode(wallet.secretKey);

console.log(JSON.stringify({
  publicKey: wallet.publicKey.toBase58(),
  privateKeyArray: JSON.stringify(privateKeyArray),
  privateKeyBase58: privateKeyBase58
}, null, 2));
