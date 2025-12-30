// ===========================================
// Fusion - Chainstack RPC Configuration
// ===========================================

import { Connection, clusterApiUrl } from '@solana/web3.js';
import WebSocket from 'ws';
import { logger } from '../shared/utils/logger.js';
import { NETWORK_ENDPOINTS } from './constants.js';

// ------------------------------------
// Connection Instances
// ------------------------------------
let httpConnection = null;
let wsConnection = null;
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 5000;

// ------------------------------------
// Get Network Configuration
// ------------------------------------
const getNetworkConfig = () => {
  const network = process.env.SOLANA_NETWORK || 'devnet';
  
  // Use Chainstack if configured, otherwise fallback to public RPC
  const httpEndpoint = process.env.CHAINSTACK_RPC_HTTP || 
    NETWORK_ENDPOINTS[network]?.http || 
    clusterApiUrl(network);
    
  const wsEndpoint = process.env.CHAINSTACK_RPC_WS || 
    NETWORK_ENDPOINTS[network]?.ws ||
    httpEndpoint.replace('https', 'wss');

  return {
    network,
    httpEndpoint,
    wsEndpoint
  };
};

// ------------------------------------
// HTTP Connection Options
// ------------------------------------
const getHttpConnectionConfig = () => ({
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
  httpHeaders: {
    'Content-Type': 'application/json'
  }
});

// ------------------------------------
// Create HTTP Connection
// ------------------------------------
export const createHttpConnection = () => {
  if (httpConnection) {
    return httpConnection;
  }

  const { httpEndpoint, network } = getNetworkConfig();
  
  httpConnection = new Connection(httpEndpoint, getHttpConnectionConfig());
  
  logger.info(`Solana HTTP connection created: ${network}`);
  logger.info(`Endpoint: ${httpEndpoint.substring(0, 50)}...`);

  return httpConnection;
};

// ------------------------------------
// Get HTTP Connection
// ------------------------------------
export const getHttpConnection = () => {
  if (!httpConnection) {
    return createHttpConnection();
  }
  return httpConnection;
};

// ------------------------------------
// WebSocket Connection Manager
// ------------------------------------
class WebSocketManager {
  constructor() {
    this.ws = null;
    this.subscriptions = new Map();
    this.messageHandlers = new Map();
    this.reconnecting = false;
    this.pingInterval = null;
    this.subscriptionId = 0;
  }

  // Connect to WebSocket
  async connect() {
    return new Promise((resolve, reject) => {
      const { wsEndpoint, network } = getNetworkConfig();

      logger.info(`Connecting to Solana WebSocket: ${network}`);

      this.ws = new WebSocket(wsEndpoint);

      // Connection opened
      this.ws.on('open', () => {
        logger.info('Solana WebSocket connected');
        wsReconnectAttempts = 0;
        this.startPingInterval();
        this.resubscribeAll();
        resolve();
      });

      // Message received
      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      // Error
      this.ws.on('error', (error) => {
        logger.error('WebSocket error:', error.message);
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          reject(error);
        }
      });

      // Connection closed
      this.ws.on('close', (code, reason) => {
        logger.warn(`WebSocket closed: ${code} - ${reason}`);
        this.stopPingInterval();
        this.handleReconnect();
      });
    });
  }

  // Handle incoming messages
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());

      // Handle subscription confirmation
      if (message.id && message.result !== undefined) {
        const handler = this.messageHandlers.get(message.id);
        if (handler) {
          handler.resolve(message.result);
          this.messageHandlers.delete(message.id);
        }
        return;
      }

      // Handle subscription data
      if (message.method === 'accountNotification' || 
          message.method === 'logsNotification' ||
          message.method === 'signatureNotification') {
        const subscriptionId = message.params?.subscription;
        const subscription = this.subscriptions.get(subscriptionId);
        
        if (subscription && subscription.callback) {
          subscription.callback(message.params.result, message.method);
        }
      }

      // Handle errors
      if (message.error) {
        logger.error('WebSocket RPC error:', message.error);
        const handler = this.messageHandlers.get(message.id);
        if (handler) {
          handler.reject(new Error(message.error.message));
          this.messageHandlers.delete(message.id);
        }
      }

    } catch (error) {
      logger.error('WebSocket message parse error:', error.message);
    }
  }

  // Send request and wait for response
  async sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = ++this.subscriptionId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      // Set timeout for response
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(id);
        reject(new Error('WebSocket request timeout'));
      }, 30000);

      // Store handler
      this.messageHandlers.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      // Send request
      this.ws.send(JSON.stringify(request));
    });
  }

  // Subscribe to account changes
  async subscribeAccount(publicKey, callback, commitment = 'confirmed') {
    const subscriptionId = await this.sendRequest('accountSubscribe', [
      publicKey,
      { encoding: 'jsonParsed', commitment }
    ]);

    this.subscriptions.set(subscriptionId, {
      type: 'account',
      publicKey,
      callback,
      commitment
    });

    logger.info(`Subscribed to account: ${publicKey.substring(0, 8)}... (ID: ${subscriptionId})`);
    
    return subscriptionId;
  }

  // Subscribe to logs (for monitoring program interactions)
  async subscribeLogs(filter, callback, commitment = 'confirmed') {
    const subscriptionId = await this.sendRequest('logsSubscribe', [
      filter,
      { commitment }
    ]);

    this.subscriptions.set(subscriptionId, {
      type: 'logs',
      filter,
      callback,
      commitment
    });

    logger.info(`Subscribed to logs (ID: ${subscriptionId})`);
    
    return subscriptionId;
  }

  // Subscribe to signature (transaction confirmation)
  async subscribeSignature(signature, callback, commitment = 'confirmed') {
    const subscriptionId = await this.sendRequest('signatureSubscribe', [
      signature,
      { commitment }
    ]);

    this.subscriptions.set(subscriptionId, {
      type: 'signature',
      signature,
      callback,
      commitment
    });

    return subscriptionId;
  }

  // Unsubscribe
  async unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      return false;
    }

    const method = {
      account: 'accountUnsubscribe',
      logs: 'logsUnsubscribe',
      signature: 'signatureUnsubscribe'
    }[subscription.type];

    try {
      await this.sendRequest(method, [subscriptionId]);
      this.subscriptions.delete(subscriptionId);
      logger.info(`Unsubscribed: ${subscriptionId}`);
      return true;
    } catch (error) {
      logger.error(`Unsubscribe error: ${error.message}`);
      return false;
    }
  }

  // Resubscribe all after reconnect
  async resubscribeAll() {
    const oldSubscriptions = new Map(this.subscriptions);
    this.subscriptions.clear();

    for (const [oldId, sub] of oldSubscriptions) {
      try {
        switch (sub.type) {
          case 'account':
            await this.subscribeAccount(sub.publicKey, sub.callback, sub.commitment);
            break;
          case 'logs':
            await this.subscribeLogs(sub.filter, sub.callback, sub.commitment);
            break;
        }
      } catch (error) {
        logger.error(`Resubscribe error for ${sub.type}: ${error.message}`);
      }
    }

    logger.info(`Resubscribed ${this.subscriptions.size} subscriptions`);
  }

  // Handle reconnection
  async handleReconnect() {
    if (this.reconnecting) {
      return;
    }

    this.reconnecting = true;
    wsReconnectAttempts++;

    if (wsReconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max WebSocket reconnect attempts reached');
      this.reconnecting = false;
      return;
    }

    const delay = RECONNECT_DELAY_MS * Math.pow(2, wsReconnectAttempts - 1);
    logger.info(`Reconnecting WebSocket in ${delay}ms (attempt ${wsReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
        this.reconnecting = false;
      } catch (error) {
        logger.error('Reconnect failed:', error.message);
        this.reconnecting = false;
        this.handleReconnect();
      }
    }, delay);
  }

  // Keep connection alive with pings
  startPingInterval() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Close connection
  async close() {
    this.stopPingInterval();
    
    // Unsubscribe all
    for (const subscriptionId of this.subscriptions.keys()) {
      await this.unsubscribe(subscriptionId);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    logger.info('WebSocket connection closed');
  }

  // Get connection status
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Get subscription count
  getSubscriptionCount() {
    return this.subscriptions.size;
  }

  // Convenience method: Subscribe to account with PublicKey object
  async subscribeToAccount(publicKey, callback, commitment = 'confirmed') {
    const address = typeof publicKey === 'string' 
      ? publicKey 
      : publicKey.toBase58();
    
    return this.subscribeAccount(address, callback, commitment);
  }
}

// ------------------------------------
// WebSocket Manager Instance
// ------------------------------------
const wsManager = new WebSocketManager();

// ------------------------------------
// Initialize WebSocket Connection
// ------------------------------------
export const initializeWebSocket = async () => {
  await wsManager.connect();
  wsConnection = wsManager;
  return wsManager;
};

// ------------------------------------
// Get WebSocket Manager
// ------------------------------------
export const getWebSocketManager = () => {
  return wsManager;
};

// ------------------------------------
// Health Check
// ------------------------------------
export const isRpcHealthy = async () => {
  try {
    const connection = getHttpConnection();
    const blockHeight = await connection.getBlockHeight();
    return blockHeight > 0;
  } catch (error) {
    logger.error('RPC health check failed:', error.message);
    return false;
  }
};

// ------------------------------------
// Get RPC Stats
// ------------------------------------
export const getRpcStats = async () => {
  try {
    const connection = getHttpConnection();
    const [blockHeight, slot, version] = await Promise.all([
      connection.getBlockHeight(),
      connection.getSlot(),
      connection.getVersion()
    ]);

    return {
      healthy: true,
      blockHeight,
      slot,
      version: version['solana-core'],
      wsConnected: wsManager.isConnected(),
      wsSubscriptions: wsManager.getSubscriptionCount()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
};

// ------------------------------------
// Close All Connections
// ------------------------------------
export const closeRpcConnections = async () => {
  await wsManager.close();
  httpConnection = null;
  logger.info('RPC connections closed');
};

// Export the wsManager instance directly
export { wsManager };

export default {
  createHttpConnection,
  getHttpConnection,
  initializeWebSocket,
  getWebSocketManager,
  isRpcHealthy,
  getRpcStats,
  closeRpcConnections,
  wsManager
};
