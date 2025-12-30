// ===========================================
// Fusion - WebSocket Event Emitter
// ===========================================

import { EventEmitter } from 'events';
import wsManager from './ws-server.js';
import { logger } from '../shared/utils/logger.js';
import { WS_EVENTS } from '../config/constants.js';

const log = logger.withContext('WSEventEmitter');

// ------------------------------------
// Event Emitter Class
// ------------------------------------

class WSEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Increase max listeners
    this.setupListeners();
  }

  // ------------------------------------
  // Setup Internal Event Listeners
  // ------------------------------------

  setupListeners() {
    // Hot Wallet Events
    this.on('hotWallet:transfer', (data) => {
      log.debug('Emitting hot wallet transfer event');
      wsManager.broadcastHotWalletTransfer(data);
    });

    // Subwallet Events
    this.on('subwallet:new', (data) => {
      log.debug('Emitting new subwallet event');
      wsManager.broadcastToRoom('subwallets', {
        type: WS_EVENTS.SUBWALLET_NEW,
        data,
        timestamp: new Date().toISOString()
      });
    });

    this.on('subwallet:mint', (data) => {
      log.debug('Emitting subwallet mint event');
      wsManager.broadcastSubwalletActivity('mint', data);
      // Forward to auto-trade manager
      this.forwardToAutoTrade('mint', data);
    });

    this.on('subwallet:pool', (data) => {
      log.debug('Emitting subwallet pool event');
      wsManager.broadcastSubwalletActivity('pool', data);
      // Forward to auto-trade manager
      this.forwardToAutoTrade('pool', data);
    });

    this.on('subwallet:buy', (data) => {
      log.debug('Emitting subwallet buy event');
      wsManager.broadcastSubwalletActivity('buy', data);
    });

    // User Wallet Events
    this.on('userWallet:signal', ({ userId, signal }) => {
      log.debug(`Emitting user wallet signal to user ${userId}`);
      wsManager.broadcastUserWalletSignal(userId, signal);
      // Forward to auto-trade manager
      this.forwardUserSignalToAutoTrade(signal);
    });

    // Trade Events
    this.on('trade:created', ({ userId, trade }) => {
      log.debug(`Emitting trade created to user ${userId}`);
      wsManager.broadcastTradeUpdate(userId, {
        action: 'created',
        trade
      });
    });

    this.on('trade:updated', ({ userId, trade }) => {
      log.debug(`Emitting trade updated to user ${userId}`);
      wsManager.broadcastTradeUpdate(userId, {
        action: 'updated',
        trade
      });
    });

    this.on('trade:completed', ({ userId, trade }) => {
      log.debug(`Emitting trade completed to user ${userId}`);
      wsManager.broadcastTradeUpdate(userId, {
        action: 'completed',
        trade
      });
    });

    this.on('trade:failed', ({ userId, trade, error }) => {
      log.debug(`Emitting trade failed to user ${userId}`);
      wsManager.broadcastTradeUpdate(userId, {
        action: 'failed',
        trade,
        error
      });
    });

    // Volume Bot Events
    this.on('volume:started', ({ userId, session }) => {
      log.debug(`Emitting volume started to user ${userId}`);
      wsManager.broadcastVolumeUpdate(userId, {
        action: 'started',
        session
      });
    });

    this.on('volume:transaction', ({ userId, session, transaction }) => {
      wsManager.broadcastVolumeUpdate(userId, {
        action: 'transaction',
        sessionId: session._id,
        transaction
      });
    });

    this.on('volume:progress', ({ userId, session }) => {
      wsManager.broadcastVolumeUpdate(userId, {
        action: 'progress',
        session: {
          id: session._id,
          progress: session.progress,
          stats: session.stats,
          currentState: session.currentState
        }
      });
    });

    this.on('volume:completed', ({ userId, session }) => {
      log.debug(`Emitting volume completed to user ${userId}`);
      wsManager.broadcastVolumeUpdate(userId, {
        action: 'completed',
        session
      });
    });

    this.on('volume:failed', ({ userId, session, error }) => {
      log.debug(`Emitting volume failed to user ${userId}`);
      wsManager.broadcastVolumeUpdate(userId, {
        action: 'failed',
        session,
        error
      });
    });

    // Testnet Token Events
    this.on('token:created', (data) => {
      log.debug('Emitting token created event');
      wsManager.broadcastToRoom('testnet', {
        type: 'TOKEN_CREATED',
        data,
        timestamp: new Date().toISOString()
      });
    });

    this.on('token:liquidity_added', (data) => {
      log.debug('Emitting token liquidity added event');
      wsManager.broadcastToRoom('testnet', {
        type: 'TOKEN_LIQUIDITY_ADDED',
        data,
        timestamp: new Date().toISOString()
      });
      // Also broadcast to specific token room
      wsManager.broadcastToRoom(`token:${data.tokenMint}`, {
        type: 'LIQUIDITY_ADDED',
        data,
        timestamp: new Date().toISOString()
      });
    });

    this.on('token:status_changed', (data) => {
      log.debug('Emitting token status changed event');
      wsManager.broadcastToRoom(`token:${data.tokenMint}`, {
        type: 'TOKEN_STATUS_CHANGED',
        data,
        timestamp: new Date().toISOString()
      });
    });

    // Trading Events (Testnet)
    this.on('trade:new', (data) => {
      log.debug('Emitting new trade event');
      // Broadcast to token-specific room
      wsManager.broadcastToRoom(`token:${data.tokenMint}`, {
        type: 'NEW_TRADE',
        data,
        timestamp: new Date().toISOString()
      });
      // Also broadcast to testnet room
      wsManager.broadcastToRoom('testnet', {
        type: 'NEW_TRADE',
        data,
        timestamp: new Date().toISOString()
      });
    });

    this.on('trade:volume_bot', (data) => {
      log.debug('Emitting volume bot trade event');
      wsManager.broadcastToRoom(`token:${data.tokenMint}`, {
        type: 'VOLUME_BOT_TRADE',
        data,
        timestamp: new Date().toISOString()
      });
    });

    // Price Update Events
    this.on('price:update', (data) => {
      wsManager.broadcastToRoom(`token:${data.tokenMint}`, {
        type: 'PRICE_UPDATE',
        data,
        timestamp: new Date().toISOString()
      });
    });

    // Candle Update Events
    this.on('candle:update', (data) => {
      wsManager.broadcastToRoom(`token:${data.tokenMint}`, {
        type: 'CANDLE_UPDATE',
        data,
        timestamp: new Date().toISOString()
      });
    });

    // Volume Bot Session Events
    this.on('volumeBot:started', (data) => {
      log.debug('Emitting volume bot started event');
      wsManager.broadcastToRoom(`token:${data.tokenMint}`, {
        type: 'VOLUME_BOT_STARTED',
        data,
        timestamp: new Date().toISOString()
      });
    });

    this.on('volumeBot:stopped', (data) => {
      log.debug('Emitting volume bot stopped event');
      wsManager.broadcastToRoom(`token:${data.tokenMint}`, {
        type: 'VOLUME_BOT_STOPPED',
        data,
        timestamp: new Date().toISOString()
      });
    });

    // System Events
    this.on('system:maintenance', (data) => {
      wsManager.broadcast({
        type: WS_EVENTS.SYSTEM_MAINTENANCE,
        data,
        timestamp: new Date().toISOString()
      });
    });

    this.on('system:notification', ({ userId, notification }) => {
      if (userId) {
        wsManager.sendToUser(userId, {
          type: WS_EVENTS.NOTIFICATION,
          data: notification,
          timestamp: new Date().toISOString()
        });
      } else {
        wsManager.broadcast({
          type: WS_EVENTS.NOTIFICATION,
          data: notification,
          timestamp: new Date().toISOString()
        });
      }
    });

    log.info('WebSocket event listeners initialized');
  }

  // ------------------------------------
  // Convenience Methods
  // ------------------------------------

  /**
   * Emit hot wallet transfer
   */
  emitHotWalletTransfer(data) {
    this.emit('hotWallet:transfer', {
      hotWalletAddress: data.hotWalletAddress,
      exchange: data.exchange,
      toAddress: data.toAddress,
      amount: data.amount,
      txSignature: data.txSignature,
      timestamp: data.timestamp || new Date().toISOString()
    });
  }

  /**
   * Emit new subwallet detected
   */
  emitNewSubwallet(data) {
    this.emit('subwallet:new', {
      address: data.address,
      sourceHotWallet: data.sourceHotWallet,
      initialAmount: data.initialAmount,
      txSignature: data.txSignature,
      timestamp: data.timestamp || new Date().toISOString()
    });
  }

  /**
   * Emit subwallet mint detected
   */
  emitSubwalletMint(data) {
    this.emit('subwallet:mint', {
      subwalletAddress: data.subwalletAddress,
      tokenMint: data.tokenMint,
      tokenName: data.tokenName,
      tokenSymbol: data.tokenSymbol,
      platform: data.platform,
      txSignature: data.txSignature,
      timestamp: data.timestamp || new Date().toISOString()
    });
  }

  /**
   * Emit subwallet pool creation detected
   */
  emitSubwalletPool(data) {
    this.emit('subwallet:pool', {
      subwalletAddress: data.subwalletAddress,
      poolAddress: data.poolAddress,
      tokenMint: data.tokenMint,
      platform: data.platform,
      initialLiquidity: data.initialLiquidity,
      txSignature: data.txSignature,
      timestamp: data.timestamp || new Date().toISOString()
    });
  }

  /**
   * Emit subwallet token buy detected
   */
  emitSubwalletBuy(data) {
    this.emit('subwallet:buy', {
      subwalletAddress: data.subwalletAddress,
      tokenMint: data.tokenMint,
      tokenSymbol: data.tokenSymbol,
      amount: data.amount,
      solSpent: data.solSpent,
      dex: data.dex,
      txSignature: data.txSignature,
      timestamp: data.timestamp || new Date().toISOString()
    });
  }

  /**
   * Emit user wallet signal
   */
  emitUserWalletSignal(userId, signal) {
    this.emit('userWallet:signal', { userId, signal });
  }

  /**
   * Emit trade event
   */
  emitTradeEvent(eventType, userId, trade, error = null) {
    this.emit(`trade:${eventType}`, { userId, trade, error });
  }

  /**
   * Emit volume bot event
   */
  emitVolumeEvent(eventType, userId, session, extra = {}) {
    this.emit(`volume:${eventType}`, { userId, session, ...extra });
  }

  /**
   * Emit system notification
   */
  emitNotification(notification, userId = null) {
    this.emit('system:notification', { userId, notification });
  }

  /**
   * Emit maintenance mode
   */
  emitMaintenanceMode(enabled, message = null) {
    this.emit('system:maintenance', {
      enabled,
      message: message || 'System is under maintenance'
    });
  }

  /**
   * Emit token created event
   */
  emitTokenCreated(tokenData) {
    this.emit('token:created', tokenData);
  }

  /**
   * Emit token liquidity added event
   */
  emitTokenLiquidityAdded(tokenMint, liquidityData) {
    this.emit('token:liquidity_added', { tokenMint, ...liquidityData });
  }

  /**
   * Emit token status changed event
   */
  emitTokenStatusChanged(tokenMint, oldStatus, newStatus) {
    this.emit('token:status_changed', { tokenMint, oldStatus, newStatus });
  }

  /**
   * Emit new trade event
   */
  emitNewTrade(tradeData) {
    this.emit('trade:new', tradeData);
  }

  /**
   * Emit volume bot trade event
   */
  emitVolumeBotTrade(tradeData) {
    this.emit('trade:volume_bot', tradeData);
  }

  /**
   * Emit price update event
   */
  emitPriceUpdate(tokenMint, price, priceChange24h) {
    this.emit('price:update', { tokenMint, price, priceChange24h });
  }

  /**
   * Emit candle update event
   */
  emitCandleUpdate(tokenMint, candle) {
    this.emit('candle:update', { tokenMint, candle });
  }

  /**
   * Emit volume bot started event
   */
  emitVolumeBotStarted(tokenMint, sessionData) {
    this.emit('volumeBot:started', { tokenMint, ...sessionData });
  }

  /**
   * Emit volume bot stopped event
   */
  emitVolumeBotStopped(tokenMint, sessionData) {
    this.emit('volumeBot:stopped', { tokenMint, ...sessionData });
  }

  /**
   * Forward subwallet signals to auto-trade manager
   */
  async forwardToAutoTrade(type, data) {
    try {
      const autoTradeService = (await import('../modules/trading-engine/auto-trade.service.js')).default;
      
      if (type === 'mint') {
        await autoTradeService.handleMintSignal(data);
      } else if (type === 'pool') {
        await autoTradeService.handlePoolSignal(data);
      }
    } catch (error) {
      log.debug('Auto-trade forward error:', error.message);
    }
  }

  /**
   * Forward user wallet signals to auto-trade manager
   */
  async forwardUserSignalToAutoTrade(signal) {
    try {
      const autoTradeService = (await import('../modules/trading-engine/auto-trade.service.js')).default;
      await autoTradeService.handleUserWalletSignal(signal);
    } catch (error) {
      log.debug('Auto-trade user signal forward error:', error.message);
    }
  }
}

// ------------------------------------
// Singleton Instance
// ------------------------------------

const wsEvents = new WSEventEmitter();

export default wsEvents;
export { WSEventEmitter };
