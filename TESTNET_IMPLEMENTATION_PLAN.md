# 🧪 FUSION Pro - Complete Testnet Implementation Plan

## Overview
Build a **100% client-side testnet environment** that simulates the entire platform without needing a backend. Everything runs in the browser using localStorage and IndexedDB.

---

## PHASE 1: Simplified Wallet Connection (Client-Side Only)

### Goals
- Remove backend dependency for wallet auth
- Simple, reliable signature verification
- Store session in localStorage

### Implementation
```javascript
// NEW: frontend/src/services/testnet/walletService.js
const TESTNET_MODE = true;

export const connectWallet = async (publicKey, signMessage) => {
  if (!TESTNET_MODE) return false;

  // Simple challenge-response
  const timestamp = Date.now();
  const message = `Sign this message to access FUSION Testnet\nTimestamp: ${timestamp}`;

  try {
    const messageBytes = new TextEncoder().encode(message);
    const signature = await signMessage(messageBytes);

    // Store in localStorage (no backend needed!)
    const session = {
      publicKey: publicKey.toBase58(),
      timestamp,
      signature: bs58.encode(signature)
    };

    localStorage.setItem('testnet_session', JSON.stringify(session));
    return true;
  } catch (error) {
    console.error('Wallet signature failed:', error);
    return false;
  }
};
```

---

## PHASE 2: Token Launchpad (Pump.fun Style)

### Features
1. **One-Click Token Creation**
   - Auto-generate token metadata
   - Create on Solana devnet
   - Store in IndexedDB

2. **Token Metadata**
   ```javascript
   {
     mint: 'TokenMintAddress',
     name: 'My Token',
     symbol: 'MTK',
     decimals: 9,
     supply: '1000000000',
     description: 'Test token for volume generation',
     image: 'data:image/svg...',  // Auto-generated avatar
     creator: 'WalletAddress',
     createdAt: timestamp,

     // Testnet specific
     bondingCurve: {
       virtualSolReserves: 30,
       virtualTokenReserves: 1000000000,
       realSolReserves: 0,
       realTokenReserves: 1000000000
     },

     // Live stats
     marketCap: 0,
     holders: 1,
     transactions: 0,
     volume24h: 0
   }
   ```

3. **UI Components**
   - Token creation wizard
   - Preview before deployment
   - Success screen with token details
   - Share testnet token link

---

## PHASE 3: Fake Liquidity System

### Raydium-Style Pool Creation
```javascript
// Simulated liquidity pool
const createLiquidityPool = (tokenMint, solAmount, tokenAmount) => {
  const pool = {
    id: generatePoolId(),
    tokenMint,
    baseMint: 'SOL',
    baseReserve: solAmount * LAMPORTS_PER_SOL,
    quoteReserve: tokenAmount,
    lpSupply: Math.sqrt(solAmount * tokenAmount),
    fee: 0.0025, // 0.25%
    createdAt: Date.now(),

    // Price calculation
    currentPrice: solAmount / tokenAmount,
    priceHistory: []
  };

  // Store in IndexedDB
  saveLiquidityPool(pool);
  return pool;
};
```

### Features
- Add/remove liquidity (simulated)
- Price impact calculation
- Slippage protection
- LP token minting
- Fee collection simulation

---

## PHASE 4: Mock Trading Engine

### Buy/Sell Simulation
```javascript
const simulateTrade = (pool, action, amount, slippage) => {
  const { baseReserve, quoteReserve, fee } = pool;

  if (action === 'buy') {
    // x * y = k AMM formula
    const amountWithFee = amount * (1 - fee);
    const newBaseReserve = baseReserve + amountWithFee;
    const newQuoteReserve = (baseReserve * quoteReserve) / newBaseReserve;
    const tokensOut = quoteReserve - newQuoteReserve;

    // Check slippage
    const expectedPrice = baseReserve / quoteReserve;
    const actualPrice = amount / tokensOut;
    const slippagePercent = ((actualPrice - expectedPrice) / expectedPrice) * 100;

    if (slippagePercent > slippage) {
      throw new Error('Slippage too high');
    }

    return {
      amountIn: amount,
      amountOut: tokensOut,
      priceImpact: slippagePercent,
      newPrice: newBaseReserve / newQuoteReserve
    };
  }

  // Similar for sell...
};
```

### Transaction History
- Store all trades in IndexedDB
- Show buy/sell markers on chart
- Calculate PnL
- Track wallet positions

---

## PHASE 5: Live Charts Integration

### Option 1: Mock Chart Data
```javascript
// Generate realistic price movement
const generateMockPriceData = (basePrice, duration) => {
  const data = [];
  let price = basePrice;
  const volatility = 0.02; // 2%

  for (let i = 0; i < duration; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility;
    price = price * (1 + change);

    data.push({
      timestamp: Date.now() - (duration - i) * 60000,
      open: price,
      high: price * (1 + Math.random() * volatility),
      low: price * (1 - Math.random() * volatility),
      close: price,
      volume: Math.random() * 1000
    });
  }

  return data;
};
```

### Option 2: TradingView Lightweight Charts
```javascript
import { createChart } from 'lightweight-charts';

const renderChart = (container, data) => {
  const chart = createChart(container, {
    width: container.offsetWidth,
    height: 400,
    layout: {
      background: { color: '#0f172a' },
      textColor: '#94a3b8',
    },
    grid: {
      vertLines: { color: '#1e293b' },
      horzLines: { color: '#1e293b' },
    },
  });

  const candlestickSeries = chart.addCandlestickSeries();
  candlestickSeries.setData(data);

  const volumeSeries = chart.addHistogramSeries({
    color: '#26a69a',
    priceFormat: { type: 'volume' },
    priceScaleId: '',
  });
  volumeSeries.setData(data.map(d => ({
    time: d.timestamp / 1000,
    value: d.volume,
    color: d.close > d.open ? '#26a69a' : '#ef5350'
  })));

  return chart;
};
```

---

## PHASE 6: Enhanced Volume Bot

### Configuration Options
```javascript
const volumeBotConfig = {
  tokenMint: 'SelectedTokenMint',

  // Transaction controls
  totalTransactions: 100,
  transactionsPerMinute: 5,
  randomizeInterval: true,  // Add variance

  // Amount controls
  minTradeAmount: 0.01,  // SOL
  maxTradeAmount: 0.5,
  useRandomAmounts: true,

  // Holder simulation
  increaseHolders: true,
  targetHolderCount: 50,
  holdersToCreate: 10,

  // Trading pattern
  buyRatio: 0.6,  // 60% buys, 40% sells
  createWashTrades: true,  // Same wallet buy/sell

  // Duration
  runDuration: 3600,  // seconds

  // Advanced
  simulateMarketMaking: true,
  maintainPriceRange: {
    min: 0.00001,
    max: 0.00005
  }
};
```

### Execution Engine
```javascript
class TestnetVolumeBot {
  constructor(config, pool) {
    this.config = config;
    this.pool = pool;
    this.executedTrades = 0;
    this.holderWallets = [];
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;

    // Create holder wallets
    if (this.config.increaseHolders) {
      await this.createHolderWallets();
    }

    // Start trade execution
    const interval = 60000 / this.config.transactionsPerMinute;
    this.tradeInterval = setInterval(() => {
      this.executeTrade();
    }, interval);
  }

  async createHolderWallets() {
    for (let i = 0; i < this.config.holdersToCreate; i++) {
      const wallet = Keypair.generate();
      this.holderWallets.push({
        publicKey: wallet.publicKey.toBase58(),
        balance: 0,
        lastTrade: null
      });
    }
  }

  async executeTrade() {
    if (this.executedTrades >= this.config.totalTransactions) {
      this.stop();
      return;
    }

    // Determine trade type
    const isBuy = Math.random() < this.config.buyRatio;
    const amount = this.randomAmount();

    // Select wallet (user or holder)
    const wallet = this.selectWallet();

    try {
      const trade = await simulateTrade(
        this.pool,
        isBuy ? 'buy' : 'sell',
        amount,
        1.0  // 1% slippage
      );

      // Record trade
      this.recordTrade({
        wallet: wallet.publicKey,
        type: isBuy ? 'buy' : 'sell',
        amountIn: trade.amountIn,
        amountOut: trade.amountOut,
        price: trade.newPrice,
        timestamp: Date.now()
      });

      // Update pool
      this.updatePool(trade);

      // Update stats
      this.executedTrades++;
      this.pool.transactions++;
      this.pool.volume24h += amount;

      // Emit progress event
      this.onProgress({
        completed: this.executedTrades,
        total: this.config.totalTransactions,
        currentPrice: this.pool.currentPrice,
        volume: this.pool.volume24h
      });

    } catch (error) {
      console.error('Trade execution failed:', error);
    }
  }

  randomAmount() {
    const { minTradeAmount, maxTradeAmount } = this.config;
    return minTradeAmount + Math.random() * (maxTradeAmount - minTradeAmount);
  }

  selectWallet() {
    // 80% chance use holder wallet, 20% use main wallet
    if (this.holderWallets.length > 0 && Math.random() > 0.2) {
      return this.holderWallets[
        Math.floor(Math.random() * this.holderWallets.length)
      ];
    }
    return { publicKey: this.config.ownerWallet };
  }

  stop() {
    this.isRunning = false;
    clearInterval(this.tradeInterval);
    this.onComplete({
      totalTrades: this.executedTrades,
      totalVolume: this.pool.volume24h,
      uniqueHolders: this.pool.holders,
      finalPrice: this.pool.currentPrice
    });
  }
}
```

---

## PHASE 7: Analytics Dashboard

### Metrics to Track
```javascript
const tokenAnalytics = {
  // Price metrics
  currentPrice: 0.00003,
  priceChange24h: 15.3,  // %
  allTimeHigh: 0.00005,
  allTimeLow: 0.00001,

  // Volume metrics
  volume24h: 125.5,  // SOL
  volumeChange24h: 23.1,  // %
  trades24h: 234,

  // Holder metrics
  totalHolders: 47,
  holdersChange24h: 8,
  top10HoldersPercent: 45.2,

  // Liquidity metrics
  liquidityUSD: 15234,
  liquidityChange24h: 12.3,

  // Chart data
  priceHistory: [],
  volumeHistory: [],
  holderHistory: [],

  // Recent trades
  recentTrades: [
    {
      type: 'buy',
      amount: 0.5,
      price: 0.00003,
      timestamp: Date.now(),
      wallet: 'ABC...XYZ'
    }
  ]
};
```

### UI Components
1. **Token Overview Card**
   - Current price + 24h change
   - Market cap
   - Holder count
   - 24h volume

2. **Price Chart**
   - Candlestick/Line chart
   - Volume bars
   - Trade markers

3. **Trade History Table**
   - Buy/sell indicators
   - Amount, price, time
   - Wallet address (shortened)

4. **Holder Distribution**
   - Pie chart of top holders
   - List of top 10

5. **Liquidity Info**
   - Pool reserves
   - LP token supply
   - 24h fees collected

---

## PHASE 8: SOL Faucet

### Rate-Limited Airdrop
```javascript
const FAUCET_AMOUNT = 2; // SOL
const COOLDOWN_PERIOD = 3600000; // 1 hour

const requestTestnetSOL = async (walletAddress) => {
  // Check cooldown
  const lastRequest = localStorage.getItem(`faucet_${walletAddress}`);
  if (lastRequest && Date.now() - lastRequest < COOLDOWN_PERIOD) {
    const remaining = COOLDOWN_PERIOD - (Date.now() - lastRequest);
    throw new Error(`Please wait ${Math.ceil(remaining / 60000)} minutes`);
  }

  try {
    // Real devnet airdrop
    const signature = await connection.requestAirdrop(
      new PublicKey(walletAddress),
      FAUCET_AMOUNT * LAMPORTS_PER_SOL
    );

    await connection.confirmTransaction(signature);

    // Update cooldown
    localStorage.setItem(`faucet_${walletAddress}`, Date.now());

    return {
      success: true,
      amount: FAUCET_AMOUNT,
      signature
    };
  } catch (error) {
    throw new Error('Airdrop failed. Try again later.');
  }
};
```

### UI
- Big friendly button
- Countdown timer for cooldown
- Recent airdrop history
- Daily limit indicator

---

## PHASE 9: Data Persistence

### IndexedDB Schema
```javascript
// Databases
const DB_NAME = 'fusion_testnet';
const DB_VERSION = 1;

// Object Stores
const STORES = {
  tokens: 'tokens',           // Created tokens
  pools: 'pools',            // Liquidity pools
  trades: 'trades',          // Trade history
  sessions: 'sessions',      // Volume bot sessions
  wallets: 'wallets'         // Holder wallets
};

// Initialize
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores
      if (!db.objectStoreNames.contains('tokens')) {
        const tokenStore = db.createObjectStore('tokens', { keyPath: 'mint' });
        tokenStore.createIndex('creator', 'creator', { unique: false });
        tokenStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('pools')) {
        const poolStore = db.createObjectStore('pools', { keyPath: 'id' });
        poolStore.createIndex('tokenMint', 'tokenMint', { unique: false });
      }

      if (!db.objectStoreNames.contains('trades')) {
        const tradeStore = db.createObjectStore('trades', { autoIncrement: true });
        tradeStore.createIndex('tokenMint', 'tokenMint', { unique: false });
        tradeStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // ... other stores
    };
  });
};
```

---

## PHASE 10: Testing Workflow

### Complete User Journey
1. **Connect Wallet** → Sign message → Session stored
2. **Get Testnet SOL** → Click faucet → Receive 2 SOL
3. **Create Token** → Fill form → Token deployed to devnet
4. **Create Pool** → Add 1 SOL + 500k tokens → Pool created
5. **Configure Volume Bot** → Set params → Start bot
6. **Watch Live** → See trades execute → Charts update
7. **Check Analytics** → View stats → See holder growth
8. **Test Trading** → Manual buy/sell → See in history

---

## IMPLEMENTATION TIMELINE

### Week 1: Foundation
- ✅ Simplified wallet connection
- ✅ Token launchpad
- ✅ Basic pool creation

### Week 2: Trading & Charts
- ✅ Mock trading engine
- ✅ Chart integration
- ✅ Transaction history

### Week 3: Volume Bot
- ✅ Enhanced configuration
- ✅ Holder simulation
- ✅ Progress tracking

### Week 4: Polish & Testing
- ✅ Analytics dashboard
- ✅ SOL faucet
- ✅ Full E2E testing

---

## SUCCESS CRITERIA

✅ Wallet connects without backend
✅ Tokens create on real devnet
✅ Liquidity pools simulate correctly
✅ Charts show live price movement
✅ Volume bot executes trades
✅ Holder count increases
✅ All data persists locally
✅ Zero backend dependency

---

## NEXT STEPS

1. **Review this plan** - Make sure it covers everything you need
2. **Approve approach** - Confirm client-side is acceptable
3. **Start implementation** - I'll build it phase by phase
4. **Test thoroughly** - We'll test each feature before moving forward
5. **Launch mainnet** - Once testnet is solid, we go live

---

**Ready to proceed?** Let me know if you want me to start building this!
