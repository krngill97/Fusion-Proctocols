/**
 * WebSocketContext.jsx
 * Simplified for DEMO MODE - WebSocket disabled
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [isConnected] = useState(false);
  const [lastMessage] = useState(null);
  const listeners = useRef(new Map());

  // Mock functions - do nothing in demo mode
  const send = useCallback(() => {}, []);
  const subscribe = useCallback(() => {}, []);
  const unsubscribe = useCallback(() => {}, []);

  const on = useCallback((eventType, callback) => {
    if (!listeners.current.has(eventType)) {
      listeners.current.set(eventType, []);
    }
    listeners.current.get(eventType).push(callback);
    return () => {
      const eventListeners = listeners.current.get(eventType) || [];
      const index = eventListeners.indexOf(callback);
      if (index > -1) eventListeners.splice(index, 1);
    };
  }, []);

  const off = useCallback((eventType, callback) => {
    const eventListeners = listeners.current.get(eventType) || [];
    const index = eventListeners.indexOf(callback);
    if (index > -1) eventListeners.splice(index, 1);
  }, []);

  const value = {
    isConnected,
    lastMessage,
    send,
    subscribe,
    unsubscribe,
    on,
    off,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;
