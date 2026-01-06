/**
 * Shared WebSocket Service
 * Single WebSocket connection shared across all components
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.subscribers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.isConnecting = false;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket('ws://localhost:5001/ws');

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.notifySubscribers('connected', true);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.notifySubscribers('message', message);
        } catch (err) {
          console.error('[WebSocket] Parse error:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.isConnecting = false;
        this.notifySubscribers('connected', false);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Closed');
        this.isConnecting = false;
        this.ws = null;
        this.notifySubscribers('connected', false);
        this.handleReconnect();
      };
    } catch (err) {
      console.error('[WebSocket] Connection failed:', err);
      this.isConnecting = false;
      this.handleReconnect();
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  subscribe(channel, callback) {
    const id = Math.random().toString(36).substr(2, 9);

    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Map());
    }

    this.subscribers.get(channel).set(id, callback);

    // Send subscribe message if connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'subscribe',
        payload: { channel }
      });
    }

    // Return unsubscribe function
    return () => {
      const channelSubs = this.subscribers.get(channel);
      if (channelSubs) {
        channelSubs.delete(id);
        if (channelSubs.size === 0) {
          this.subscribers.delete(channel);

          // Unsubscribe from channel
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({
              type: 'unsubscribe',
              payload: { channel }
            });
          }
        }
      }
    };
  }

  notifySubscribers(event, data) {
    if (event === 'connected') {
      // Notify all subscribers about connection status
      for (const [channel, callbacks] of this.subscribers.entries()) {
        for (const callback of callbacks.values()) {
          callback({ type: 'connected', data });
        }
      }
    } else if (event === 'message') {
      // Route message to appropriate subscribers
      const messageType = data.type;

      // Notify all subscribers
      for (const [channel, callbacks] of this.subscribers.entries()) {
        for (const callback of callbacks.values()) {
          callback(data);
        }
      }
    }
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscribers.clear();
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
const wsService = new WebSocketService();

export default wsService;
