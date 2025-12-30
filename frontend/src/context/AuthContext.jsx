/**
 * AuthContext.jsx
 * Simplified for DEMO MODE - no backend authentication required
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const { connected, disconnect, publicKey } = useWallet();
  const [isLoading] = useState(false);

  // In demo mode: connected wallet = authenticated
  const isAuthenticated = connected;

  // Mock user based on wallet
  const user = connected && publicKey ? {
    walletAddress: publicKey.toBase58(),
    preferences: {}
  } : null;

  // Sign in - not needed in demo mode
  const signIn = useCallback(async () => {
    return true;
  }, []);

  // Logout - just disconnect wallet
  const logout = useCallback(async () => {
    try {
      await disconnect();
      toast.success('Disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }, [disconnect]);

  // Mock functions
  const updatePreferences = useCallback(async () => {
    toast.success('Preferences updated (demo)');
    return true;
  }, []);

  const refreshUser = useCallback(async () => {
    return true;
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    signIn,
    logout,
    updatePreferences,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
