# Volume Bot - Real Solana Blockchain Integration Guide

## 🎯 Overview

The Fusion Volume Bot is now **fully integrated with REAL Solana blockchain** (devnet, testnet, and mainnet-beta). It executes actual on-chain transactions to generate trading volume for your tokens.

---

## 🔧 Quick Setup

### 1. Configure Network (backend/.env)

```bash
# For DEVNET testing (recommended to start)
SOLANA_NETWORK=devnet
CHAINSTACK_RPC_HTTP=https://api.devnet.solana.com
CHAINSTACK_RPC_WS=wss://api.devnet.solana.com

# For TESTNET
SOLANA_NETWORK=testnet
CHAINSTACK_RPC_HTTP=https://api.testnet.solana.com
CHAINSTACK_RPC_WS=wss://api.testnet.solana.com

# For MAINNET (production)
SOLANA_NETWORK=mainnet-beta
CHAINSTACK_RPC_HTTP=https://api.mainnet-beta.solana.com
CHAINSTACK_RPC_WS=wss://api.mainnet-beta.solana.com
```

### 2. Fund Your Trading Wallet

The volume bot requires a funded trading wallet to execute transactions:

1. **Demo Mode** (current): A demo wallet is automatically created
2. **Production**: Connect your real Solana wallet with sufficient SOL balance

#### Get Devnet SOL (Free)
```bash
# Visit Solana faucet
https://faucet.solana.com/

# Or use CLI
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

---

## 🚀 How the Volume Bot Works

### Architecture

```
User Creates Session → Funds Distributed → Trading Loop Starts
                           ↓
                  Maker Wallets Created
                           ↓
              Real On-Chain Transactions
                           ↓
              Volume Generated on Token
```

### Real Blockchain Features

#### ✅ **Devnet Mode** (Simulated Trading)
- Uses SOL transfers between maker wallets
- Simulates buy/sell volume
- **Cost**: Minimal (only network fees ~0.00001 SOL per tx)
- **Best For**: Testing volume bot functionality

#### ✅ **Mainnet Mode** (Real Trading)
- Executes actual token swaps via Jupiter DEX
- Real buy/sell transactions
- Generates authentic trading volume
- **Cost**: Deposit amount + network fees
- **Best For**: Production volume generation

---

## 📊 Volume Bot Configuration

### Session Parameters

```javascript
{
  tokenMint: "YOUR_TOKEN_MINT_ADDRESS",  // Token to generate volume for
  depositAmount: 10,                      // Total SOL to use (e.g., 10 SOL)
  config: {
    makerWalletCount: 10,                // Number of wallets (5-20)
    minTradeAmount: 0.001,               // Min SOL per trade
    maxTradeAmount: 0.01,                // Max SOL per trade
    tradeIntervalMin: 5000,              // Min time between trades (ms)
    tradeIntervalMax: 15000,             // Max time between trades (ms)
    targetVolume: 100,                   // Target volume in SOL
    maxDuration: 3600000,                // Max run time (1 hour)
    buySellRatio: 0.5,                   // 50% buys, 50% sells
    useRandomAmounts: true,              // Randomize trade amounts
    useRandomTiming: true,               // Randomize trade timing
    network: 'devnet'                    // devnet | testnet | mainnet-beta
  }
}
```

### Optimal Settings for High Volume, Low Cost

```javascript
{
  depositAmount: 5,                      // 5 SOL deposit
  config: {
    makerWalletCount: 10,                // 10 wallets
    minTradeAmount: 0.001,               // 0.001 SOL per trade
    maxTradeAmount: 0.01,                // 0.01 SOL per trade
    tradeIntervalMin: 2000,              // 2 second min interval
    tradeIntervalMax: 8000,              // 8 second max interval
    targetVolume: 50,                    // 50 SOL target volume
    buySellRatio: 0.6,                   // 60% buys, 40% sells
    network: 'devnet'                    // Start with devnet
  }
}
```

**Expected Output:**
- **Volume Generated**: ~50 SOL in 30-60 minutes
- **Cost**: Initial deposit recycled through trades
- **Transactions**: 200-500 on-chain trades

---

## 🔐 Security & Best Practices

### 1. Network Selection Strategy

| Network | Use Case | Risk Level | Cost |
|---------|----------|------------|------|
| **Devnet** | Testing, development | None | Free |
| **Testnet** | Pre-production testing | None | Free |
| **Mainnet** | Production volume | Real funds | Real SOL |

### 2. Wallet Security

```javascript
// Trading wallets are encrypted in database
{
  publicKey: "wallet_address",
  encryptedPrivateKey: "AES-256 encrypted",  // Never stored in plain text
  isDefault: true
}
```

### 3. Fund Management

- **Start Small**: Test with 1-5 SOL on devnet
- **Gradual Scale**: Increase deposit after successful test runs
- **Monitor Sessions**: Track volume/cost ratio in real-time
- **Withdraw Funds**: Remaining SOL returned when session completes

---

## 📱 Using the Volume Bot

### Via Frontend (Recommended)

1. Navigate to **Volume Bot** page
2. Enter token mint address
3. Set deposit amount
4. Configure parameters (or use defaults)
5. Click **Create Session**
6. Click **Start** to begin trading

### Via API

```bash
# Create Session
curl -X POST http://localhost:5000/api/volume/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "tokenMint": "YOUR_TOKEN_MINT",
    "depositAmount": 5,
    "config": {
      "makerWalletCount": 10,
      "targetVolume": 50,
      "network": "devnet"
    }
  }'

# Start Session
curl -X POST http://localhost:5000/api/volume/sessions/{SESSION_ID}/start

# Check Status
curl http://localhost:5000/api/volume/sessions/{SESSION_ID}

# Get Transaction History
curl http://localhost:5000/api/volume/sessions/{SESSION_ID}/transactions
```

---

## 🔄 Switching Between Networks

### From Devnet to Mainnet

1. **Update .env**
```bash
SOLANA_NETWORK=mainnet-beta
CHAINSTACK_RPC_HTTP=https://api.mainnet-beta.solana.com
CHAINSTACK_RPC_WS=wss://api.mainnet-beta.solana.com
```

2. **Restart Backend**
```bash
cd backend
npm run dev
```

3. **Fund Wallet** with real SOL

4. **Create Session** with `network: 'mainnet-beta'`

### Best Practice: Test First

```javascript
// 1. Test on Devnet
{ network: 'devnet', depositAmount: 1 }

// 2. Verify on Testnet
{ network: 'testnet', depositAmount: 2 }

// 3. Deploy on Mainnet
{ network: 'mainnet-beta', depositAmount: 10 }
```

---

## 📈 Monitoring & Analytics

### Real-Time Metrics

- **Total Volume**: SOL traded across all transactions
- **Transaction Count**: Number of buy/sell trades executed
- **Success Rate**: Percentage of successful transactions
- **Average Trade Size**: Mean trade amount
- **Trades Per Minute**: Current trading velocity
- **Progress**: % towards target volume and time

### Transaction Tracking

Each transaction includes:
- **Type**: buy | sell
- **Amount**: SOL traded
- **Maker Wallet**: Which wallet executed trade
- **TX Signature**: Solana Explorer link
- **Timestamp**: When trade occurred
- **Status**: success | failed

### View on Solana Explorer

```
Devnet: https://explorer.solana.com/tx/{SIGNATURE}?cluster=devnet
Testnet: https://explorer.solana.com/tx/{SIGNATURE}?cluster=testnet
Mainnet: https://explorer.solana.com/tx/{SIGNATURE}
```

---

## ⚠️ Important Considerations

### Devnet Limitations

- Tokens may not exist on devnet
- Limited liquidity pools
- Network may reset periodically
- Best for **testing bot functionality**, not actual volume

### Mainnet Requirements

- **Real SOL** required (not free)
- **Real tokens** must exist on mainnet
- **Liquidity pools** must be available (Jupiter/Raydium)
- **Network fees** apply to all transactions
- **Slippage** can impact trade execution

### Cost Estimation (Mainnet)

```
Deposit: 10 SOL
Trades: 500 transactions
Network Fees: ~0.00001 SOL × 500 = 0.005 SOL
Slippage: ~0.5% × 10 SOL = 0.05 SOL
Total Cost: ~0.055 SOL + slippage variance
Volume Generated: 10 SOL × recycle rate = 50-100 SOL
```

---

## 🛠️ Troubleshooting

### "Insufficient Balance" Error

**Solution**: Fund your trading wallet with more SOL
```bash
# Check balance
solana balance YOUR_WALLET --url devnet

# Get more devnet SOL
solana airdrop 5 YOUR_WALLET --url devnet
```

### "No Liquidity Pools Found" Error

**Solution**:
- Verify token exists on selected network
- Check liquidity pools on Jupiter/Raydium
- Try devnet for simulation mode

### Transactions Failing

**Solution**:
- Increase priority fee in config
- Reduce trade frequency (increase intervals)
- Check network status
- Verify wallet has sufficient SOL

### Session Stuck in "Funding" State

**Solution**:
- Check wallet balance
- Verify network connectivity
- Restart backend if needed

---

## 🎓 Advanced Configuration

### High-Frequency Trading

```javascript
{
  tradeIntervalMin: 1000,    // 1 second
  tradeIntervalMax: 3000,    // 3 seconds
  makerWalletCount: 20,      // Max wallets
  priorityFee: 100000        // Higher priority
}
```

### Natural-Looking Volume

```javascript
{
  tradeIntervalMin: 5000,    // 5 seconds
  tradeIntervalMax: 30000,   // 30 seconds
  useRandomAmounts: true,    // Vary amounts
  useRandomTiming: true,     // Vary timing
  buySellRatio: 0.55         // 55/45 buy/sell ratio
}
```

### Cost-Efficient Volume

```javascript
{
  minTradeAmount: 0.001,     // Minimum trades
  maxTradeAmount: 0.005,     // Small max
  makerWalletCount: 15,      // Medium wallets
  tradeIntervalMin: 3000,    // Slower pace
  targetVolume: 20           // Modest target
}
```

---

## 📞 Support

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check /docs folder for more guides
- **Logs**: Backend logs show detailed transaction info

---

## ✅ Summary Checklist

- [ ] Backend .env configured for desired network
- [ ] Trading wallet funded with sufficient SOL
- [ ] Token exists on selected network
- [ ] Liquidity pools available (for mainnet)
- [ ] Session parameters configured
- [ ] Monitoring dashboard open
- [ ] Ready to generate volume! 🚀

---

**Made with Fusion Pro** | Real Blockchain Integration | Solana Devnet/Testnet/Mainnet Ready
