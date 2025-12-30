/**
 * WalletContext.jsx
 * Fixed for modern wallet-adapter - no manual wallet adapters needed
 */

import { createContext, useContext, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { useNetwork } from './NetworkContext';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

const WalletContext = createContext(null);

export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const { endpoint, currentNetwork, isTestnet } = useNetwork();

  // Empty wallets array - let wallet-standard auto-detect wallets like Phantom
  // Modern wallets register themselves automatically
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <WalletContext.Provider value={{ network: currentNetwork, endpoint, isTestnet }}>
            {children}
          </WalletContext.Provider>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

export default WalletProvider;
