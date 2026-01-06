# Advanced Volume Bots - Quick Start Guide

## Overview

FUSION Pro includes two advanced volume bot strategies to generate organic trading volume for your Solana tokens:

1. **Enhanced Volume Bot** - Creates liquidity and generates volume with multiple wallets
2. **Recycling Volume Bot** - Maximizes volume by recycling capital through buy/sell cycles

## Accessing the Volume Bots

### Frontend
Navigate to: `http://localhost:5173/advanced-bots`

### Backend API Endpoints

**Enhanced Volume Bot:**
- Start Session: `POST /api/enhanced-volume/sessions`
- Get Session: `GET /api/enhanced-volume/sessions/:sessionId`
- Stop Session: `POST /api/enhanced-volume/sessions/:sessionId/stop`

**Recycling Volume Bot:**
- Start Session: `POST /api/recycling-volume/start`
- Get All Sessions: `GET /api/recycling-volume/sessions`
- Get Session: `GET /api/recycling-volume/session/:sessionId`
- Stop Session: `POST /api/recycling-volume/session/:sessionId/stop`

---

## Enhanced Volume Bot

### What It Does
1. Creates 10 wallets
2. Funds them with SOL from your funding wallet
3. Distributes tokens to all wallets
4. Wallet #1 creates a liquidity pool
5. All 10 wallets continuously buy/sell to generate volume

### Configuration

```json
{
  "tokenMint": "YOUR_TOKEN_MINT_ADDRESS",
  "fundingWalletPrivateKey": "YOUR_WALLET_PRIVATE_KEY",
  "config": {
    "walletCount": 10,           // Number of trading wallets (2-20)
    "solPerWallet": 0.3,         // SOL to give each wallet (0.01-1)
    "tokensPerWallet": 10000,    // Tokens to give each wallet (100-100000)
    "liquiditySOL": 0.5,         // SOL for liquidity pool (0.01-5)
    "liquidityTokens": 50000,    // Tokens for liquidity pool (1000-1000000)
    "tradesPerMinute": 5,        // Trading frequency (1-20)
    "durationMinutes": 60,       // How long to run (1-180)
    "minTradeAmount": 100,       // Min tokens per trade (10-1000)
    "maxTradeAmount": 1000       // Max tokens per trade (100-10000)
  }
}
```

### Total SOL Required
```
Total = (walletCount × solPerWallet) + liquiditySOL + 0.1 (fees)
Default = (10 × 0.3) + 0.5 + 0.1 = 3.6 SOL
```

### Example API Request
```bash
curl -X POST http://localhost:5000/api/enhanced-volume/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "tokenMint": "YourTokenMintAddress",
    "fundingWalletPrivateKey": "YourPrivateKey",
    "config": {
      "walletCount": 10,
      "solPerWallet": 0.3,
      "liquiditySOL": 0.5,
      "tradesPerMinute": 5,
      "durationMinutes": 60
    }
  }'
```

### Use Cases
- New token launches that need initial liquidity
- Tokens that need organic-looking trading activity
- Creating price discovery through real trades

---

## Recycling Volume Bot

### What It Does
1. Creates 20 wallets
2. Distributes your capital among them
3. Rapidly cycles: Buy tokens → Sell tokens → Repeat
4. Same capital generates 10-20x volume through recycling
5. Stops when target volume reached or max loss hit

### Configuration

```json
{
  "tokenMint": "YOUR_TOKEN_MINT_ADDRESS",
  "fundingWalletPrivateKey": "YOUR_WALLET_PRIVATE_KEY",
  "config": {
    "startingCapital": 1.0,      // Total SOL to use (0.1-10)
    "walletCount": 20,           // Number of wallets (5-20)
    "tradesPerMinute": 20,       // Trading speed (5-30)
    "targetVolume": 20,          // Target volume in SOL (1-100)
    "maxLossPercent": 20,        // Max acceptable loss % (5-50)
    "durationMinutes": 60,       // Max duration (5-180)
    "buyRatio": 0.6,             // Buy probability 60% (0.4-0.8)
    "minTradeSize": 0.01,        // Min SOL per trade (0.005-0.1)
    "maxTradeSize": 0.05         // Max SOL per trade (0.01-0.2)
  }
}
```

### Volume Multiplier
```
Multiplier = targetVolume / startingCapital
Default = 20 SOL / 1.0 SOL = 20x
```

### Total SOL Required
```
Total = startingCapital + 0.1 (fees)
Default = 1.0 + 0.1 = 1.1 SOL
```

### Example API Request
```bash
curl -X POST http://localhost:5000/api/recycling-volume/start \
  -H "Content-Type: application/json" \
  -d '{
    "tokenMint": "YourTokenMintAddress",
    "fundingWalletPrivateKey": "YourPrivateKey",
    "config": {
      "startingCapital": 1.0,
      "walletCount": 20,
      "tradesPerMinute": 20,
      "targetVolume": 20,
      "maxLossPercent": 20
    }
  }'
```

### Use Cases
- Maximizing volume with limited capital
- Quick volume spikes for visibility
- Testing token liquidity under high trading activity

---

## Getting Private Keys

### From Phantom Wallet
1. Open Phantom
2. Settings → Show Secret Recovery Phrase
3. Export as base58 string

### From Solana CLI
```bash
solana-keygen new --outfile wallet.json
cat wallet.json
```

### Supported Formats
Both bots accept private keys in:
- **Base58 format**: `5K8Qj3...` (recommended)
- **JSON array format**: `[1,2,3,...]`

---

## Monitoring Sessions

### Frontend
View active sessions with real-time stats:
- Total volume generated
- Number of trades
- Capital status (for recycling bot)
- Buy/sell ratio
- Session status

### Backend Logs
Watch the terminal for detailed trade logs:
```
🟢 BUY: 500.00 tokens for 0.0250 SOL | Volume: 15.50 SOL (15.5x)
🔴 SELL: 300.00 tokens for 0.0145 SOL | Volume: 15.51 SOL (15.5x)
```

---

## Stopping Sessions

### Via Frontend
Click "Stop Session" button on any running session

### Via API
```bash
# Enhanced Bot
curl -X POST http://localhost:5000/api/enhanced-volume/sessions/SESSION_ID/stop

# Recycling Bot
curl -X POST http://localhost:5000/api/recycling-volume/session/SESSION_ID/stop
```

---

## Important Notes

### Devnet vs Mainnet
- Currently configured for **Solana Devnet**
- No real funds used on devnet
- For mainnet, change `SOLANA_NETWORK=mainnet` in `.env`

### Transactions on Solscan
All transactions are verifiable:
```
https://solscan.io/tx/TRANSACTION_SIGNATURE?cluster=devnet
```

### Rate Limits
- Enhanced Bot: 1-20 trades/minute
- Recycling Bot: 5-30 trades/minute
- Recommended: Start conservative, scale up

### Capital Safety
- Recycling bot has built-in loss protection
- Stops automatically at `maxLossPercent`
- Enhanced bot uses simulated constant-product pricing

---

## Troubleshooting

### "Insufficient SOL" Error
**Solution:** Fund your wallet with more SOL
```bash
solana airdrop 5 YOUR_WALLET_ADDRESS --url devnet
```

### "Invalid private key" Error
**Solution:**
- Check format (base58 or JSON array)
- Ensure no extra spaces or quotes
- Try exporting key again

### No Trades Executing
**Solution:**
1. Check backend logs for errors
2. Verify token mint address is correct
3. Ensure token exists on the network
4. Check wallet has token balance (for recycling bot)

### Session Not Stopping
**Solution:**
- Session may be in transition
- Wait a few seconds and refresh
- Check backend logs for completion message

---

## Performance Optimization

### For Maximum Volume
Use **Recycling Bot**:
- High `tradesPerMinute` (25-30)
- High `walletCount` (15-20)
- Higher `targetVolume`

### For Organic Activity
Use **Enhanced Bot**:
- Moderate `tradesPerMinute` (3-8)
- Lower `walletCount` (5-10)
- Longer `durationMinutes`

### For Capital Efficiency
Use **Recycling Bot**:
- Lower `startingCapital`
- Higher volume multiplier
- Tight `maxLossPercent` (10-15%)

---

## Examples

### Example 1: New Token Launch
**Goal:** Create liquidity and initial volume
**Bot:** Enhanced
**Config:**
```json
{
  "walletCount": 8,
  "solPerWallet": 0.5,
  "liquiditySOL": 1.0,
  "liquidityTokens": 100000,
  "tradesPerMinute": 5,
  "durationMinutes": 120
}
```

### Example 2: Volume Spike for Visibility
**Goal:** Generate 50 SOL volume with 2 SOL
**Bot:** Recycling
**Config:**
```json
{
  "startingCapital": 2.0,
  "walletCount": 20,
  "tradesPerMinute": 25,
  "targetVolume": 50,
  "maxLossPercent": 15
}
```

### Example 3: Sustained Background Activity
**Goal:** Continuous low-volume trading
**Bot:** Enhanced
**Config:**
```json
{
  "walletCount": 6,
  "solPerWallet": 0.2,
  "liquiditySOL": 0.3,
  "tradesPerMinute": 3,
  "durationMinutes": 180
}
```

---

## Support

For issues or questions:
1. Check backend logs: `npm run dev` in backend folder
2. Check browser console in frontend
3. Review this guide's troubleshooting section
4. Check MongoDB connection
5. Verify Solana RPC connection

**Backend Running:** `http://localhost:5000`
**Frontend Running:** `http://localhost:5173`
**Health Check:** `http://localhost:5000/health`

---

## Next Steps

1. Get devnet SOL: `solana airdrop 10 YOUR_ADDRESS --url devnet`
2. Create or use existing token
3. Navigate to `/advanced-bots` in frontend
4. Choose your strategy
5. Configure and launch
6. Monitor in real-time
7. View results on Solscan

Happy volume generation! 🚀
