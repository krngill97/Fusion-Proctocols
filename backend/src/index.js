// ===========================================
// Fusion - Main Server Entry Point
// ===========================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';

// Config imports
import { connectDatabase, getConnectionStatus } from './config/database.js';
import { createRedisClient, initializeQueues, isRedisHealthy } from './config/redis.js';
import { createHttpConnection, initializeWebSocket, getRpcStats } from './config/chainstack.js';

// Middleware imports
import { generalLimiter } from './shared/middleware/rate-limiter.middleware.js';
import { 
  errorHandler, 
  notFoundHandler, 
  setupUncaughtHandlers 
} from './shared/middleware/error-handler.middleware.js';

// Utility imports
import { logger } from './shared/utils/logger.js';
import { validateEncryptionSetup } from './shared/services/encryption.service.js';

// ------------------------------------
// Initialize Express App
// ------------------------------------

const app = express();
const httpServer = createServer(app);

// ------------------------------------
// Environment Variables
// ------------------------------------

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ------------------------------------
// Setup Uncaught Exception Handlers
// ------------------------------------

setupUncaughtHandlers();

// ------------------------------------
// Middleware Configuration
// ------------------------------------

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false
}));

// CORS configuration
app.use(cors({
  origin: NODE_ENV === 'production' 
    ? [FRONTEND_URL] 
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// HTTP request logging
if (NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: logger.stream }));
}

// Rate limiting
app.use('/api', generalLimiter);

// ------------------------------------
// Health Check Endpoint
// ------------------------------------

app.get('/health', async (req, res) => {
  try {
    const dbStatus = getConnectionStatus();
    const redisHealthy = await isRedisHealthy();
    const rpcStats = await getRpcStats();
    const wsStats = { totalClients: 0, authenticatedClients: 0, rooms: 0 }; // wsManager.getStats();

    const isHealthy =
      dbStatus.state === 'connected' &&
      redisHealthy &&
      rpcStats.healthy;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      services: {
        database: {
          status: dbStatus.state,
          host: dbStatus.host
        },
        redis: {
          status: redisHealthy ? 'connected' : 'disconnected'
        },
        solana: {
          status: rpcStats.healthy ? 'connected' : 'disconnected',
          network: process.env.SOLANA_NETWORK || 'devnet',
          blockHeight: rpcStats.blockHeight,
          wsConnected: rpcStats.wsConnected,
          subscriptions: rpcStats.wsSubscriptions
        },
        websocket: {
          clients: wsStats.totalClients,
          authenticated: wsStats.authenticatedClients,
          rooms: wsStats.rooms
        }
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error.message);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ------------------------------------
// API Routes (to be added in future prompts)
// ------------------------------------

app.get('/api', (req, res) => {
  res.json({
    name: 'Fusion API',
    version: '1.0.0',
    description: 'Solana Wallet Tracker & Trading System',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      hotWallets: '/api/hot-wallets',
      subwallets: '/api/subwallets',
      userWallets: '/api/user-wallets',
      trading: '/api/trading',
      volume: '/api/volume',
      testnet: '/api/testnet'
    }
  });
});

// Import routes
import authRoutes from './modules/auth/auth.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import hotWalletRoutes from './modules/hot-wallet-tracker/hot-wallet.routes.js';
import subwalletRoutes from './modules/subwallet-analyzer/subwallet.routes.js';
import userWalletRoutes from './modules/user-wallet-tracker/user-wallet.routes.js';
import tradingRoutes from './modules/trading-engine/trading.routes.js';
import volumeRoutes from './modules/volume-bot/volume.routes.js';
import testnetRoutes from './modules/testnet-tokens/testnet.routes.js';
import solanaTokenRoutes from './modules/testnet-tokens/solana-token.routes.js';
import devnetVolumeRoutes from './routes/devnet-volume.routes.js';

// Import WebSocket
import { wsManager } from './websocket/index.js';

// Auth routes
app.use('/api/auth', authRoutes);

// Settings routes
app.use('/api/settings', settingsRoutes);

// Hot wallet routes
app.use('/api/hot-wallets', hotWalletRoutes);

// Subwallet routes
app.use('/api/subwallets', subwalletRoutes);

// User wallet routes
app.use('/api/user-wallets', userWalletRoutes);

// Trading routes
app.use('/api/trading', tradingRoutes);

// Volume bot routes
app.use('/api/volume', volumeRoutes);

// Testnet trading simulator routes
app.use('/api/testnet', testnetRoutes);

// Real Solana blockchain routes
app.use('/api/solana', solanaTokenRoutes);

// Devnet volume bot routes
app.use('/api/devnet-volume', devnetVolumeRoutes);

// ------------------------------------
// Error Handling
// ------------------------------------

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ------------------------------------
// Graceful Shutdown
// ------------------------------------

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connection
      const { disconnectDatabase } = await import('./config/database.js');
      await disconnectDatabase();
      
      // Close Redis connection
      const { closeRedis } = await import('./config/redis.js');
      await closeRedis();
      
      // Close RPC connections
      const { closeRpcConnections } = await import('./config/chainstack.js');
      await closeRpcConnections();
      
      // Close WebSocket server
      wsManager.close();
      
      logger.info('All connections closed. Exiting...');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error.message);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ------------------------------------
// Server Startup
// ------------------------------------

const startServer = async () => {
  try {
    logger.info('====================================');
    logger.info('   FUSION - Starting Server...     ');
    logger.info('====================================');

    // Validate encryption setup
    logger.info('Validating encryption setup...');
    const encryptionValid = validateEncryptionSetup();
    if (!encryptionValid) {
      logger.warn('Encryption validation failed - check ENCRYPTION_KEY');
    }

    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDatabase();

    // Connect to Redis
    logger.info('Connecting to Redis...');
    createRedisClient();
    
    // Initialize job queues
    logger.info('Initializing job queues...');
    initializeQueues();

    // Initialize Solana HTTP connection
    logger.info('Initializing Solana RPC connection...');
    createHttpConnection();

    // Initialize Solana WebSocket connection
    logger.info('Initializing Solana WebSocket...');
    await initializeWebSocket();

    // Initialize WebSocket server for clients
    // TEMPORARILY DISABLED - WebSocket causing startup issues
    // logger.info('Initializing client WebSocket server...');
    // wsManager.initialize(httpServer);

    // Start HTTP server with better error handling
    httpServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error('====================================');
        logger.error(`   PORT ${PORT} IS ALREADY IN USE   `);
        logger.error('====================================');
        logger.error('\nAnother process is using port ' + PORT);
        logger.error('\nTo fix this:');
        logger.error('Windows: netstat -ano | findstr :' + PORT);
        logger.error('         taskkill /PID [PID] /F');
        logger.error('Mac/Linux: lsof -i :' + PORT);
        logger.error('           kill -9 [PID]\n');
        process.exit(1);
      } else {
        logger.error('Server error:', error);
        process.exit(1);
      }
    });

    httpServer.on('listening', () => {
      logger.info('====================================');
      logger.info(`   FUSION Server Running!          `);
      logger.info(`   Environment: ${NODE_ENV}        `);
      logger.info(`   Port: ${PORT}                   `);
      logger.info(`   Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);
      logger.info('====================================');
    });

    httpServer.listen(PORT);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export { app, httpServer };
// trigger restart
