# Fusion - Solana Trading Platform

A comprehensive Solana wallet tracking, trading, and volume generation system.

## Features

- **Hot Wallet Tracker**: Monitor exchange hot wallets for transfers
- **Subwallet Analyzer**: Detect and track subwallets for mints/pools
- **User Wallet Tracker**: Track any wallet and receive trading signals
- **Trading Engine**: Execute swaps via Jupiter and Raydium
- **Auto-Trading**: Copy trading, sniping, take profit, stop loss
- **Volume Bot**: Generate organic-looking trading volume

## Prerequisites

- **Node.js** v18.0.0 or higher
- **MongoDB** v6.0+ (local or Atlas)
- **Redis** v7.0+ (local or cloud)
- **Solana Wallet** (Phantom or Solflare)

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd fusion

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment

```bash
# Backend configuration
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Required - Database
MONGODB_URI=mongodb://localhost:27017/fusion

# Required - Redis
REDIS_URL=redis://localhost:6379

# Required - Security (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=your-64-char-secret-here

# Required - Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your-32-char-hex-key-here

# Optional - Solana RPC (defaults to devnet public RPC)
SOLANA_NETWORK=devnet
CHAINSTACK_RPC_HTTP=https://api.devnet.solana.com
CHAINSTACK_RPC_WS=wss://api.devnet.solana.com
```

### 3. Start Services

**Option A: Local MongoDB & Redis**

```bash
# Start MongoDB (macOS)
brew services start mongodb-community

# Start Redis (macOS)
brew services start redis

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:6
docker run -d -p 6379:6379 --name redis redis:7
```

**Option B: Cloud Services (Free Tiers)**

- MongoDB Atlas: https://cloud.mongodb.com
- Upstash Redis: https://upstash.com
- Railway: https://railway.app

### 4. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Access the App

1. Open http://localhost:3000
2. Click "Select Wallet" and choose Phantom or Solflare
3. Sign the authentication message
4. Start using Fusion!

## Project Structure

```
fusion/
├── backend/
│   ├── src/
│   │   ├── config/           # Database, Redis, Chainstack config
│   │   ├── modules/
│   │   │   ├── auth/         # Authentication (SIWS)
│   │   │   ├── settings/     # User settings
│   │   │   ├── hot-wallet-tracker/
│   │   │   ├── subwallet-analyzer/
│   │   │   ├── user-wallet-tracker/
│   │   │   ├── trading-engine/
│   │   │   └── volume-bot/
│   │   ├── shared/           # Middleware, utils, services
│   │   ├── websocket/        # WebSocket server
│   │   └── index.js          # Entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── context/          # React context providers
│   │   ├── pages/            # Page components
│   │   ├── services/         # API client
│   │   ├── styles/           # CSS
│   │   └── main.jsx          # Entry point
│   └── package.json
│
└── README.md
```

## API Endpoints

| Module | Endpoint | Description |
|--------|----------|-------------|
| Auth | `POST /api/auth/nonce` | Get authentication nonce |
| Auth | `POST /api/auth/verify` | Verify wallet signature |
| Hot Wallets | `GET /api/hot-wallets` | List tracked hot wallets |
| Hot Wallets | `POST /api/hot-wallets` | Add hot wallet |
| Subwallets | `GET /api/subwallets` | List detected subwallets |
| User Wallets | `GET /api/user-wallets` | List tracked wallets |
| User Wallets | `POST /api/user-wallets` | Add wallet to track |
| Trading | `POST /api/trading/buy` | Execute buy |
| Trading | `POST /api/trading/sell` | Execute sell |
| Volume | `POST /api/volume/sessions` | Create volume session |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 5000 | Server port |
| `NODE_ENV` | No | development | Environment |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `REDIS_URL` | Yes | - | Redis connection string |
| `JWT_SECRET` | Yes | - | JWT signing secret (64+ chars) |
| `ENCRYPTION_KEY` | Yes | - | Wallet encryption key (32 hex chars) |
| `SOLANA_NETWORK` | No | devnet | Solana network |
| `CHAINSTACK_RPC_HTTP` | No | Public RPC | HTTP RPC endpoint |
| `CHAINSTACK_RPC_WS` | No | Public RPC | WebSocket RPC endpoint |

## Troubleshooting

### MongoDB Connection Failed
```bash
# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Or check Docker container
docker ps | grep mongo
```

### Redis Connection Failed
```bash
# Check if Redis is running
redis-cli ping

# Should return: PONG
```

### Wallet Won't Connect
- Make sure you have Phantom or Solflare extension installed
- Try refreshing the page
- Check browser console for errors

### CORS Errors
- Ensure backend is running on port 5000
- Frontend should be on port 3000
- Check FRONTEND_URL in backend .env

## Development

```bash
# Run backend with hot reload
cd backend && npm run dev

# Run frontend with hot reload
cd frontend && npm run dev

# Seed database with test data
cd backend && npm run seed

# Clear database
cd backend && npm run db:clear
```

## Production Deployment

```bash
# Build frontend
cd frontend && npm run build

# Start backend in production mode
cd backend && NODE_ENV=production npm start
```

## Security Notes

- Never commit `.env` files
- Use strong JWT secrets (64+ characters)
- Use strong encryption keys (32 hex characters)
- Enable rate limiting in production
- Use HTTPS in production

## License

MIT
