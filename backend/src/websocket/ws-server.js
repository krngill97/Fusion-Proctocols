// ===========================================
// Fusion - WebSocket Server Manager
// ===========================================

import { WebSocketServer, WebSocket } from 'ws';
import { authenticateWebSocket } from '../shared/middleware/auth.middleware.js';
import { logger } from '../shared/utils/logger.js';
import { WS_EVENTS } from '../config/constants.js';
import { wsRateLimiter } from '../shared/middleware/rate-limiter.middleware.js';

const log = logger.withContext('WebSocketServer');

// ------------------------------------
// WebSocket Manager Class
// ------------------------------------

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map<clientId, { ws, user, subscriptions }>
    this.rooms = new Map(); // Map<roomName, Set<clientId>>
    this.heartbeatInterval = null;
    this.isInitialized = false;
  }

  // ------------------------------------
  // Initialize WebSocket Server
  // ------------------------------------

  initialize(httpServer) {
    if (this.isInitialized) {
      log.warn('WebSocket server already initialized');
      return;
    }

    this.wss = new WebSocketServer({ 
      server: httpServer,
      path: '/ws',
      clientTracking: true
    });

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (error) => {
      log.error('WebSocket server error:', error.message);
    });

    // Start heartbeat checker
    this.startHeartbeat();

    this.isInitialized = true;
    log.info('WebSocket server initialized on /ws');
  }

  // ------------------------------------
  // Handle New Connection
  // ------------------------------------

  async handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Rate limiting
    if (!wsRateLimiter(clientIp)) {
      ws.close(4029, 'Too many connections');
      log.warn(`Rate limited WebSocket connection from ${clientIp}`);
      return;
    }

    // Initialize client data
    const clientData = {
      ws,
      user: null,
      subscriptions: new Set(),
      isAlive: true,
      connectedAt: new Date(),
      ip: clientIp
    };

    this.clients.set(clientId, clientData);

    log.info(`WebSocket client connected: ${clientId}`);

    // Set up event handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', () => this.handleClose(clientId));
    ws.on('error', (error) => this.handleError(clientId, error));
    ws.on('pong', () => this.handlePong(clientId));

    // Send welcome message
    this.send(clientId, {
      type: WS_EVENTS.CONNECTED,
      data: {
        clientId,
        message: 'Connected to Fusion WebSocket',
        timestamp: new Date().toISOString()
      }
    });
  }

  // ------------------------------------
  // Handle Incoming Messages
  // ------------------------------------

  async handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      this.sendError(clientId, 'INVALID_JSON', 'Invalid JSON message');
      return;
    }

    const { type, payload } = message;

    log.debug(`WebSocket message from ${clientId}: ${type}`);

    switch (type) {
      case 'auth':
        await this.handleAuth(clientId, payload);
        break;

      case 'subscribe':
        this.handleSubscribe(clientId, payload);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(clientId, payload);
        break;

      case 'ping':
        this.send(clientId, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        this.sendError(clientId, 'UNKNOWN_TYPE', `Unknown message type: ${type}`);
    }
  }

  // ------------------------------------
  // Authentication
  // ------------------------------------

  async handleAuth(clientId, payload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { token } = payload || {};

    if (!token) {
      this.sendError(clientId, 'AUTH_REQUIRED', 'Token required for authentication');
      return;
    }

    try {
      const user = await authenticateWebSocket(token);
      client.user = user;

      // Join user-specific room
      this.joinRoom(clientId, `user:${user.id}`);

      this.send(clientId, {
        type: WS_EVENTS.AUTHENTICATED,
        data: {
          userId: user.id,
          walletAddress: user.walletAddress
        }
      });

      log.info(`WebSocket client authenticated: ${clientId} (${user.walletAddress.slice(0, 8)}...)`);
    } catch (error) {
      this.sendError(clientId, 'AUTH_FAILED', error.message);
    }
  }

  // ------------------------------------
  // Subscriptions
  // ------------------------------------

  handleSubscribe(clientId, payload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel } = payload || {};

    if (!channel) {
      this.sendError(clientId, 'INVALID_CHANNEL', 'Channel required for subscription');
      return;
    }

    // Check if auth required for channel
    const authRequiredChannels = ['trades', 'user-wallets', 'volume-sessions'];
    if (authRequiredChannels.includes(channel) && !client.user) {
      this.sendError(clientId, 'AUTH_REQUIRED', 'Authentication required for this channel');
      return;
    }

    // Add to subscription
    client.subscriptions.add(channel);
    this.joinRoom(clientId, channel);

    this.send(clientId, {
      type: WS_EVENTS.SUBSCRIBED,
      data: { channel }
    });

    log.debug(`Client ${clientId} subscribed to ${channel}`);
  }

  handleUnsubscribe(clientId, payload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel } = payload || {};

    if (!channel) {
      this.sendError(clientId, 'INVALID_CHANNEL', 'Channel required for unsubscription');
      return;
    }

    client.subscriptions.delete(channel);
    this.leaveRoom(clientId, channel);

    this.send(clientId, {
      type: WS_EVENTS.UNSUBSCRIBED,
      data: { channel }
    });

    log.debug(`Client ${clientId} unsubscribed from ${channel}`);
  }

  // ------------------------------------
  // Room Management
  // ------------------------------------

  joinRoom(clientId, roomName) {
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }
    this.rooms.get(roomName).add(clientId);
  }

  leaveRoom(clientId, roomName) {
    const room = this.rooms.get(roomName);
    if (room) {
      room.delete(clientId);
      if (room.size === 0) {
        this.rooms.delete(roomName);
      }
    }
  }

  leaveAllRooms(clientId) {
    for (const [roomName, clients] of this.rooms.entries()) {
      clients.delete(clientId);
      if (clients.size === 0) {
        this.rooms.delete(roomName);
      }
    }
  }

  // ------------------------------------
  // Send Messages
  // ------------------------------------

  send(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      log.error(`Error sending to client ${clientId}: ${error.message}`);
      return false;
    }
  }

  sendError(clientId, code, message) {
    this.send(clientId, {
      type: WS_EVENTS.ERROR,
      error: { code, message }
    });
  }

  // ------------------------------------
  // Broadcast Methods
  // ------------------------------------

  /**
   * Broadcast to all connected clients
   */
  broadcast(message, filter = null) {
    let count = 0;
    for (const [clientId, client] of this.clients.entries()) {
      if (filter && !filter(client)) continue;
      if (this.send(clientId, message)) count++;
    }
    return count;
  }

  /**
   * Broadcast to a specific room/channel
   */
  broadcastToRoom(roomName, message) {
    const room = this.rooms.get(roomName);
    if (!room) return 0;

    let count = 0;
    for (const clientId of room) {
      if (this.send(clientId, message)) count++;
    }
    return count;
  }

  /**
   * Send to a specific user (all their connections)
   */
  sendToUser(userId, message) {
    return this.broadcastToRoom(`user:${userId}`, message);
  }

  /**
   * Broadcast hot wallet transfer event
   */
  broadcastHotWalletTransfer(data) {
    return this.broadcastToRoom('hot-wallets', {
      type: WS_EVENTS.HOT_WALLET_TRANSFER,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast subwallet activity event
   */
  broadcastSubwalletActivity(eventType, data) {
    const typeMap = {
      mint: WS_EVENTS.SUBWALLET_MINT,
      pool: WS_EVENTS.SUBWALLET_POOL,
      buy: WS_EVENTS.SUBWALLET_BUY
    };

    return this.broadcastToRoom('subwallets', {
      type: typeMap[eventType] || WS_EVENTS.SUBWALLET_ACTIVITY,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast user wallet signal to specific user
   */
  broadcastUserWalletSignal(userId, data) {
    return this.sendToUser(userId, {
      type: WS_EVENTS.USER_WALLET_SIGNAL,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast trade update to specific user
   */
  broadcastTradeUpdate(userId, data) {
    return this.sendToUser(userId, {
      type: WS_EVENTS.TRADE_UPDATE,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast volume session update to specific user
   */
  broadcastVolumeUpdate(userId, data) {
    return this.sendToUser(userId, {
      type: WS_EVENTS.VOLUME_UPDATE,
      data,
      timestamp: new Date().toISOString()
    });
  }

  // ------------------------------------
  // Connection Management
  // ------------------------------------

  handleClose(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.leaveAllRooms(clientId);
    this.clients.delete(clientId);

    log.info(`WebSocket client disconnected: ${clientId}`);
  }

  handleError(clientId, error) {
    log.error(`WebSocket error for client ${clientId}: ${error.message}`);
  }

  handlePong(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
    }
  }

  // ------------------------------------
  // Heartbeat
  // ------------------------------------

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients.entries()) {
        if (!client.isAlive) {
          // Connection dead, terminate
          log.debug(`Terminating inactive client: ${clientId}`);
          client.ws.terminate();
          this.handleClose(clientId);
          continue;
        }

        client.isAlive = false;
        client.ws.ping();
      }
    }, 30000); // 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ------------------------------------
  // Utility Methods
  // ------------------------------------

  generateClientId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    const authenticatedClients = Array.from(this.clients.values())
      .filter(c => c.user !== null).length;

    return {
      totalClients: this.clients.size,
      authenticatedClients,
      anonymousClients: this.clients.size - authenticatedClients,
      rooms: this.rooms.size,
      roomDetails: Object.fromEntries(
        Array.from(this.rooms.entries()).map(([name, clients]) => [name, clients.size])
      )
    };
  }

  getClientCount() {
    return this.clients.size;
  }

  isClientAuthenticated(clientId) {
    const client = this.clients.get(clientId);
    return client?.user !== null;
  }

  // ------------------------------------
  // Cleanup
  // ------------------------------------

  close() {
    this.stopHeartbeat();

    // Close all client connections
    for (const [clientId, client] of this.clients.entries()) {
      client.ws.close(1000, 'Server shutting down');
    }

    this.clients.clear();
    this.rooms.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.isInitialized = false;
    log.info('WebSocket server closed');
  }
}

// ------------------------------------
// Singleton Instance
// ------------------------------------

const wsManager = new WebSocketManager();

export default wsManager;
export { WebSocketManager };
