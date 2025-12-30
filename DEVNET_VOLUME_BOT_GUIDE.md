# Devnet Volume Bot - Complete Guide

## 🚀 Generate REAL Volume on Solana Devnet

This guide shows you how to create **real SPL tokens** on Solana devnet and generate **real on-chain volume** visible on **Solscan.io**.

---

## ✅ What You Get

- ✅ Real SPL tokens on Solana devnet
- ✅ Real on-chain transactions
- ✅ Visible on Solscan.io/devnet
- ✅ Real transaction signatures
- ✅ No liquidity pools required
- ✅ Simple token transfers for volume

---

## 📋 Step-by-Step Instructions

### Step 1: Get Devnet SOL

**Option A: Using Solana CLI**
```bash
solana airdrop 2 --url devnet
```

**Option B: Using Web Faucet**
1. Go to https://faucet.solana.com
2. Enter your wallet address
3. Select "Devnet"
4. Request airdrop

**Option C: Using the App**
1. Go to http://localhost:5173/real-token-launch
2. Connect your wallet (set to Devnet in Phantom/Solflare)
3. Click "Request Airdrop" button
4. Wait for confirmation

---

### Step 2: Create Real Token on Devnet

1. **Navigate to Real Token Launch**
   - URL: http://localhost:5173/real-token-launch

2. **Connect Wallet**
   - Make sure your wallet is set to **Devnet** network
   - Click "Connect Wallet"

3. **Fill Token Details**
   ```
   Name: My Test Token
   Symbol: TEST
   Description: Testing volume generation
   Initial Supply: 1,000,000
   Decimals: 9
   ```

4. **Launch Token**
   - Click "Launch Token"
   - Approve the transaction in your wallet
   - Wait for confirmation

5. **Save Token Details**
   - Copy the **Mint Address** (e.g., `5vRRikKgA6Fzq3dRgSCvEbUw3bWw54wBivYTZnHLzSXi`)
   - Copy your **Wallet Private Key** (needed for volume bot)

6. **View on Solscan**
   - https://solscan.io/token/[YOUR_MINT_ADDRESS]?cluster=devnet

---

### Step 3: Export Your Wallet Private Key

**For Phantom Wallet:**
1. Click on the menu (3 dots)
2. Settings → Security & Privacy
3. Export Private Key
4. Enter password
5. Copy the private key array (e.g., `[123,45,67,...]`)

**For Solflare:**
1. Settings → Export Private Key
2. Confirm with password
3. Copy the private key

**⚠️ SECURITY WARNING**
- Only use this on devnet/testnet
- Never share your mainnet private key
- Keep it secure

---

### Step 4: Start Volume Generation

**Using API (Recommended):**

```bash
curl -X POST http://localhost:5000/api/devnet-volume/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "tokenMint": "YOUR_TOKEN_MINT_ADDRESS",
    "fundingWalletPrivateKey": "[123,45,67,...]",
    "config": {
      "walletCount": 5,
      "tradesPerMinute": 2,
      "durationMinutes": 30,
      "minTransferAmount": 10,
      "maxTransferAmount": 100
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "devnet_session_1234567890_abc123",
    "status": "initializing",
    "wallets": [
      "Wallet1PublicKey...",
      "Wallet2PublicKey...",
      "Wallet3PublicKey...",
      "Wallet4PublicKey...",
      "Wallet5PublicKey..."
    ],
    "startTime": "2025-12-28T10:00:00.000Z",
    "endTime": "2025-12-28T10:30:00.000Z"
  }
}
```

---

### Step 5: Monitor Your Session

**Get Session Status:**
```bash
curl http://localhost:5000/api/devnet-volume/sessions/[SESSION_ID]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "devnet_session_1234567890_abc123",
    "tokenMint": "5vRRikKgA6Fzq3dRgSCvEbUw3bWw54wBivYTZnHLzSXi",
    "status": "running",
    "stats": {
      "totalTransfers": 15,
      "totalVolume": 750,
      "successfulTransfers": 15,
      "failedTransfers": 0
    },
    "recentTransactions": [
      {
        "signature": "3Kx...",
        "amount": 50,
        "timestamp": "2025-12-28T10:15:00.000Z",
        "solscanUrl": "https://solscan.io/tx/3Kx...?cluster=devnet"
      }
    ]
  }
}
```

---

### Step 6: View on Solscan

**Your Token Page:**
```
https://solscan.io/token/[YOUR_MINT_ADDRESS]?cluster=devnet
```

**Transaction Details:**
```
https://solscan.io/tx/[TRANSACTION_SIGNATURE]?cluster=devnet
```

**What You'll See:**
- ✅ Token transfers between wallets
- ✅ Real transaction signatures
- ✅ Block confirmations
- ✅ Transaction history
- ✅ Holder distribution

---

## 🎯 Configuration Options

### Session Config Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `walletCount` | number | 5 | Number of maker wallets to create |
| `tradesPerMinute` | number | 2 | Transfer frequency |
| `durationMinutes` | number | 30 | How long to run |
| `minTransferAmount` | number | 10 | Minimum tokens per transfer |
| `maxTransferAmount` | number | 100 | Maximum tokens per transfer |

### Example Configurations

**High Volume (Fast):**
```json
{
  "walletCount": 10,
  "tradesPerMinute": 5,
  "durationMinutes": 60,
  "minTransferAmount": 50,
  "maxTransferAmount": 200
}
```

**Low Volume (Slow):**
```json
{
  "walletCount": 3,
  "tradesPerMinute": 1,
  "durationMinutes": 120,
  "minTransferAmount": 5,
  "maxTransferAmount": 20
}
```

---

## 🔧 API Endpoints

### Start Session
```
POST /api/devnet-volume/sessions
```

### Get Session
```
GET /api/devnet-volume/sessions/:sessionId
```

### Stop Session
```
POST /api/devnet-volume/sessions/:sessionId/stop
```

### Get All Sessions
```
GET /api/devnet-volume/sessions
```

---

## 🎬 What Happens Behind the Scenes

1. **Initialization (15-30 seconds)**
   - Creates N maker wallets
   - Airdrops 0.1 SOL to each wallet
   - Creates token accounts for each wallet
   - Transfers initial tokens from your wallet

2. **Volume Generation Loop**
   - Picks two random wallets
   - Transfers tokens from wallet A to wallet B
   - Creates real on-chain transaction
   - Waits for confirmation
   - Repeats based on `tradesPerMinute`

3. **Completion**
   - Session ends after `durationMinutes`
   - All transactions visible on Solscan
   - Wallets retain their token balances

---

## ⚠️ Important Notes

### Limitations
- Only works on **devnet** (not mainnet)
- Requires tokens in your wallet to distribute
- Rate limited by Solana devnet (may fail during high load)
- Airdrop may fail if devnet is congested

### Best Practices
- Start with small amounts for testing
- Monitor the first few transactions on Solscan
- Keep your private key secure (devnet only!)
- Don't run too many sessions simultaneously

### Troubleshooting

**"Airdrop failed"**
- Devnet is rate-limited
- Wait 1-2 minutes and try again
- Or use https://faucet.solana.com

**"Session status: failed"**
- Check if you have enough tokens
- Verify private key is correct format
- Check backend logs for details

**"No transactions showing on Solscan"**
- Wait 10-20 seconds for indexing
- Refresh the Solscan page
- Check if session status is "running"

---

## 📊 Example Session Flow

```
[10:00:00] Session created: devnet_session_123
[10:00:01] Status: initializing
[10:00:05] Airdropping SOL to 5 wallets...
[10:00:15] Creating token accounts...
[10:00:25] Distributing initial tokens...
[10:00:30] Status: running
[10:00:32] Transfer 1: 45 tokens (3Kx...abc)
           Solscan: https://solscan.io/tx/3Kx...abc?cluster=devnet
[10:01:02] Transfer 2: 78 tokens (7Hy...def)
           Solscan: https://solscan.io/tx/7Hy...def?cluster=devnet
[10:01:32] Transfer 3: 23 tokens (9Qz...ghi)
           Solscan: https://solscan.io/tx/9Qz...ghi?cluster=devnet
...
[10:30:00] Session completed
           Total: 60 transfers, 3,450 tokens moved
```

---

## 🎉 Success Checklist

- [ ] Got devnet SOL
- [ ] Created real token on devnet
- [ ] Token visible on Solscan
- [ ] Exported wallet private key
- [ ] Started volume session
- [ ] Session status: "running"
- [ ] Transactions appearing on Solscan
- [ ] Multiple wallets holding tokens

---

## 💡 Next Steps

Once you've tested on devnet, you can:
1. Use the same approach for mainnet (with REAL SOL)
2. Create liquidity pools for proper trading
3. Integrate with Jupiter for real swaps
4. Build custom volume strategies

---

## 🆘 Need Help?

- Check backend logs: See console output
- API errors: Check response messages
- Solscan not updating: Wait 30 seconds and refresh
- Session stuck: Stop and create a new one

---

**Happy Testing! 🚀**

All your devnet transactions are real blockchain activity visible to everyone on Solscan.io!
