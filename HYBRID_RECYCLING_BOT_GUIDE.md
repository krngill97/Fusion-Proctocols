# 🚀 Hybrid Recycling Volume Bot - Complete Guide

## Overview

The **Hybrid Recycling Volume Bot** combines the best of both worlds:
- ♻️ **Capital-efficient recycling strategy** - Recycles SOL through buy/sell cycles for maximum volume multiplier
- 🔗 **Real Jupiter DEX swaps** - All trades execute on-chain and are verifiable on Solscan
- ⚡ **Parallel execution** - Execute multiple trades simultaneously for 50-70% faster performance
- 🎯 **Smart optimization** - Dynamic slippage, intelligent wallet rotation, loss protection

## Key Features

### ✅ Real On-Chain Trading
- Uses Jupiter aggregator for best swap routes
- All transactions verifiable on Solscan devnet
- Real price impact and slippage
- Actual liquidity pool interactions

### ✅ Capital Efficiency
- **10-20x volume multiplier** through recycling
- Same capital generates massive volume through buy/sell cycles
- Smart loss threshold protection
- Configurable maximum loss percentage

### ✅ Performance Optimizations
- **Parallel trade execution** - Execute 3-5 trades simultaneously
- **Dynamic slippage** - Automatically adjust slippage based on trade size
- **Smart wallet rotation** - Prioritize wallets with optimal balances
- **Batch wallet funding** - Fund multiple wallets in parallel

### ✅ Real-Time Monitoring
- WebSocket events for live updates
- Detailed console logging with Solscan links
- Track volume multiplier in real-time
- Success/failure rate tracking

## How It Works

### Strategy Flow

```
1. CREATE WALLETS
   └─> Generate 10-50 trading wallets

2. FUND WALLETS
   └─> Distribute starting capital evenly across all wallets
   └─> Parallel batch funding for speed

3. CONTINUOUS TRADING LOOP
   └─> Execute real Jupiter swaps:
       ├─> BUY: SOL → Token (using wallets with SOL)
       ├─> SELL: Token → SOL (using wallets with tokens)
       └─> Recycle continuously until target reached

4. SMART TERMINATION
   └─> Stop when:
       ├─> Target volume reached (e.g., 10 SOL → 200 SOL volume = 20x)
       ├─> Max loss threshold hit (e.g., 20% capital loss)
       ├─> Duration exceeded
       └─> Capital depleted
```

### Trade Decision Logic

The bot uses intelligent logic to decide buy vs sell:

1. **Must sell** if no wallets have SOL (force recycling)
2. **Must buy** if no wallets have tokens (maintain supply)
3. **Adaptive balancing**:
   - If >70% wallets have tokens → favor sells
   - If <30% wallets have tokens → favor buys
   - Otherwise → use configured buy ratio (default 55%)

## Configuration Options

### Basic Configuration

```json
{
  "tokenMint": "YOUR_TOKEN_MINT_ADDRESS",
  "fundingWalletPrivateKey": "YOUR_PRIVATE_KEY",
  "config": {
    "startingCapital": 1.0,        // Total SOL to deploy
    "walletCount": 20,              // Number of trading wallets
    "tradesPerMinute": 20,          // Trade frequency
    "targetVolume": 20,             // Stop at this volume (SOL)
    "maxLossPercent": 20,           // Max acceptable loss %
    "durationMinutes": 60           // Max runtime
  }
}
```

### Advanced Configuration

```json
{
  "config": {
    // Capital & Wallets
    "startingCapital": 1.0,         // 0.05 - 10 SOL
    "walletCount": 20,              // 5 - 50 wallets

    // Trading Frequency
    "tradesPerMinute": 20,          // 1 - 50 trades/min
    "parallelTrades": 3,            // 1 - 10 parallel trades

    // Volume Targets
    "targetVolume": 20,             // 0.1 - 1000 SOL
    "durationMinutes": 60,          // 1 - 480 minutes

    // Risk Management
    "maxLossPercent": 20,           // 5 - 50 percent

    // Trade Sizing
    "buyRatio": 0.55,               // 0.3 - 0.7 (55% buys, 45% sells)
    "minTradeSize": 0.01,           // 0.005 - 1 SOL
    "maxTradeSize": 0.05,           // 0.01 - 5 SOL

    // Slippage
    "slippageBps": 300,             // 100 - 1000 basis points (3%)
    "enableDynamicSlippage": true   // Auto-adjust slippage
  }
}
```

## Usage Examples

### Example 1: Conservative Strategy
**Goal:** Generate 5 SOL volume with minimal risk

```json
{
  "tokenMint": "YOUR_TOKEN_MINT",
  "fundingWalletPrivateKey": "YOUR_KEY",
  "config": {
    "startingCapital": 0.3,
    "walletCount": 10,
    "tradesPerMinute": 10,
    "targetVolume": 5,
    "maxLossPercent": 15,
    "minTradeSize": 0.008,
    "maxTradeSize": 0.025,
    "slippageBps": 250,
    "parallelTrades": 2
  }
}
```

**Expected Results:**
- Volume: ~5 SOL (16x multiplier)
- Duration: ~30-45 minutes
- Loss: <10%
- Success rate: >85%

### Example 2: Balanced Strategy
**Goal:** Generate 10 SOL volume with moderate speed

```json
{
  "tokenMint": "YOUR_TOKEN_MINT",
  "fundingWalletPrivateKey": "YOUR_KEY",
  "config": {
    "startingCapital": 0.5,
    "walletCount": 15,
    "tradesPerMinute": 20,
    "targetVolume": 10,
    "maxLossPercent": 25,
    "minTradeSize": 0.01,
    "maxTradeSize": 0.04,
    "slippageBps": 300,
    "parallelTrades": 3
  }
}
```

**Expected Results:**
- Volume: ~10 SOL (20x multiplier)
- Duration: ~20-30 minutes
- Loss: 15-20%
- Success rate: >80%

### Example 3: Aggressive Strategy
**Goal:** Maximum volume in shortest time

```json
{
  "tokenMint": "YOUR_TOKEN_MINT",
  "fundingWalletPrivateKey": "YOUR_KEY",
  "config": {
    "startingCapital": 1.0,
    "walletCount": 25,
    "tradesPerMinute": 30,
    "targetVolume": 25,
    "maxLossPercent": 30,
    "minTradeSize": 0.015,
    "maxTradeSize": 0.06,
    "slippageBps": 400,
    "parallelTrades": 5
  }
}
```

**Expected Results:**
- Volume: ~25 SOL (25x multiplier)
- Duration: ~20-40 minutes
- Loss: 20-30%
- Success rate: >75%

## API Endpoints

### Start Session
```http
POST /api/hybrid-recycling-volume/start
Content-Type: application/json

{
  "tokenMint": "string",
  "fundingWalletPrivateKey": "string",
  "config": { /* config object */ }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "hybrid_recycling_1234567890_abc123",
  "session": {
    "sessionId": "...",
    "tokenMint": "...",
    "status": "running",
    "capital": {
      "starting": 1.0,
      "current": 1.0,
      "lossPercent": 0
    },
    "metrics": {
      "totalVolume": 0,
      "volumeMultiplier": 0,
      "totalTrades": 0,
      "successfulTrades": 0,
      "buyTrades": 0,
      "sellTrades": 0
    }
  }
}
```

### Get Session Status
```http
GET /api/hybrid-recycling-volume/session/{sessionId}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "sessionId": "...",
    "status": "running",
    "capital": {
      "starting": 1.0,
      "current": 0.85,
      "lossPercent": 15,
      "spentOnFees": 0.002
    },
    "metrics": {
      "totalVolume": 12.5,
      "volumeMultiplier": 12.5,
      "totalTrades": 156,
      "successfulTrades": 148,
      "failedTrades": 8,
      "buyTrades": 86,
      "sellTrades": 62,
      "cycles": 62,
      "avgSlippage": 2.3
    },
    "elapsed": 1234,
    "remaining": 2366
  }
}
```

### Get All Sessions
```http
GET /api/hybrid-recycling-volume/sessions
```

### Stop Session
```http
POST /api/hybrid-recycling-volume/session/{sessionId}/stop
```

## Using with curl

```bash
# Start session
curl -X POST http://localhost:5000/api/hybrid-recycling-volume/start \
  -H "Content-Type: application/json" \
  -d @start-hybrid-recycling-bot.json

# Get session status
curl http://localhost:5000/api/hybrid-recycling-volume/session/SESSION_ID

# Stop session
curl -X POST http://localhost:5000/api/hybrid-recycling-volume/session/SESSION_ID/stop
```

## Performance Comparison

| Bot Type | Volume Multiplier | Real Swaps | Speed | Capital Efficiency |
|----------|------------------|------------|-------|-------------------|
| Devnet Bot | 1-3x | ✅ Yes | Medium | Low |
| Enhanced Bot | 5-8x | ❌ No (Simulated) | Fast | Medium |
| Recycling Bot | 10-20x | ❌ No (Simulated) | Fast | High |
| **Hybrid Recycling** | **10-20x** | **✅ Yes** | **Fast** | **High** |

## Best Practices

### 1. Start Small
- Test with 0.1-0.3 SOL first
- Use conservative settings
- Monitor for 5-10 minutes

### 2. Optimize for Your Token
- **Low liquidity tokens**: Use higher slippage (400-600 bps)
- **High liquidity tokens**: Use lower slippage (200-300 bps)
- **New tokens**: Start with fewer wallets (5-10)
- **Established tokens**: Use more wallets (20-30)

### 3. Monitor Performance
- Watch success rate (should be >75%)
- Check average slippage (should be <5%)
- Monitor capital loss (should stay under max threshold)
- Verify transactions on Solscan

### 4. Adjust Configuration
- If too many failed trades → increase slippage
- If volume too slow → increase parallel trades
- If losing capital too fast → reduce trade sizes
- If hitting loss threshold → reduce max loss %

## Troubleshooting

### Issue: Many Failed Trades
**Solutions:**
- Increase `slippageBps` (try 400-500)
- Reduce `maxTradeSize`
- Check token has sufficient liquidity
- Reduce `parallelTrades` to avoid congestion

### Issue: Volume Too Slow
**Solutions:**
- Increase `tradesPerMinute`
- Increase `parallelTrades`
- Increase `maxTradeSize`
- Add more `walletCount`

### Issue: Hitting Loss Threshold
**Solutions:**
- Increase `maxLossPercent` if acceptable
- Reduce `maxTradeSize` to minimize slippage
- Enable `dynamicSlippage` if not already
- Use tokens with better liquidity

### Issue: Out of SOL
**Solutions:**
- Check funding wallet has enough SOL
- Reduce `startingCapital`
- Reduce `walletCount`
- Account for fees (~0.2 SOL extra recommended)

## WebSocket Events

The bot emits real-time events:

```javascript
// Session started
{
  event: 'sessionStarted',
  data: {
    sessionId, tokenMint, walletCount, startingCapital, targetVolume
  }
}

// New trade completed
{
  event: 'newTrade',
  data: {
    sessionId, tokenMint, type, solAmount, tokenAmount,
    signature, volumeMultiplier
  }
}

// Session stopped
{
  event: 'sessionStopped',
  data: {
    sessionId, totalVolume, volumeMultiplier, totalTrades, duration
  }
}
```

## Security Notes

1. **Never commit private keys** to version control
2. **Use devnet for testing** before mainnet
3. **Start with small amounts** to test
4. **Monitor sessions actively** when running
5. **Use dedicated wallets** for volume bots

## Example Output

```
======================================================================
🚀 HYBRID RECYCLING VOLUME BOT - Real Jupiter Swaps
======================================================================
Token: ABC123...XYZ789
Starting Capital: 0.5 SOL
Wallet Count: 15
Target Volume: 10 SOL (20x multiplier)
Max Loss: 25%
Duration: 30 minutes
Parallel Trades: 3 (60/min effective rate)
Dynamic Slippage: ENABLED

💰 Funding Wallet: 7xK9...mN4p
📊 Current Balance: 0.7234 SOL

[Step 1/3] Creating 15 Wallets...
  ✅ Wallet 1: 4kL2...9Xm1
  ✅ Wallet 2: 8pQ5...2Yn3
  ✅ Wallet 3: 1rT8...5Zp7
  ... (12 more wallets)

[Step 2/3] Funding Wallets (0.0333 SOL each)...
  Using parallel batch funding for speed...
  ✅ Funded wallet 1: a7b2cd...
  ✅ Funded wallet 2: e8f9gh...
  [All wallets funded]

[Step 3/3] Starting Real Jupiter Swap Trading Loop...

✅ HYBRID RECYCLING VOLUME BOT STARTED!
Session ID: hybrid_recycling_1735689012_xyz456
Real Jupiter swaps will execute every 1.0 seconds
All transactions verifiable on Solscan devnet
======================================================================

  🟢 REAL BUY: 0.0245 SOL → Tokens (Wallet: ...9Xm1)
  ✅ BUY SUCCESS: 1234.56 tokens | Slippage: 1.8%
  📊 Volume: 0.0245 SOL (0.0x)
  🔗 https://solscan.io/tx/3kL9...?cluster=devnet

  🔴 REAL SELL: 567.89 tokens → SOL (Wallet: ...2Yn3)
  ✅ SELL SUCCESS: 0.0112 SOL | Slippage: 2.1%
  📊 Volume: 0.0357 SOL (0.1x)
  🔗 https://solscan.io/tx/8pQ2...?cluster=devnet

... [Trades continue] ...

🎯 STOPPING: Target volume reached (10.23 SOL)

======================================================================
🏁 HYBRID RECYCLING VOLUME BOT STOPPED
======================================================================
Session ID: hybrid_recycling_1735689012_xyz456

📊 FINAL STATS:
Total Volume: 10.23 SOL
Volume Multiplier: 20.5x
Total Trades: 187 (178 successful, 9 failed)
Success Rate: 95.2%
Buys: 103 | Sells: 75
Completed Cycles: 75
Average Slippage: 2.1%

💰 CAPITAL:
Starting: 0.5000 SOL
Final: 0.4123 SOL
Loss: 17.54%
Fees Paid: ~0.0009 SOL
Duration: 18.3 minutes
======================================================================
```

## Advanced Tips

### Maximizing Volume Multiplier
- Use more wallets (25-30) for longer recycling chains
- Increase duration to allow more cycles
- Balance buy/sell ratio at 0.5-0.6 for optimal recycling
- Start with token-heavy distribution

### Minimizing Capital Loss
- Enable dynamic slippage
- Use conservative trade sizes
- Set strict max loss threshold
- Monitor and adjust in real-time

### Fastest Execution
- Max out parallel trades (5-10)
- High trades per minute (30-50)
- Larger trade sizes
- More starting capital

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review console logs for detailed error messages
3. Verify transactions on Solscan
4. Check WebSocket events for real-time status

---

**Happy Trading! 🚀**
