import { createContext, useContext, useState, useMemo } from 'react';
import { clusterApiUrl } from '@solana/web3.js';

const NetworkContext = createContext(null);

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
};

export const NETWORKS = {
  MAINNET: 'mainnet-beta',
  TESTNET: 'devnet',
};

export const NetworkProvider = ({ children }) => {
  // Load network preference from localStorage or default to devnet (testnet)
  const [currentNetwork, setCurrentNetwork] = useState(() => {
    return localStorage.getItem('selectedNetwork') || NETWORKS.TESTNET;
  });

  const [isTestnet, setIsTestnet] = useState(currentNetwork === NETWORKS.TESTNET);

  // Get RPC endpoint based on network
  const endpoint = useMemo(() => {
    if (currentNetwork === NETWORKS.MAINNET && import.meta.env.VITE_RPC_ENDPOINT) {
      return import.meta.env.VITE_RPC_ENDPOINT;
    }
    if (currentNetwork === NETWORKS.TESTNET && import.meta.env.VITE_DEVNET_RPC_ENDPOINT) {
      return import.meta.env.VITE_DEVNET_RPC_ENDPOINT;
    }
    return clusterApiUrl(currentNetwork);
  }, [currentNetwork]);

  // Switch network function
  const switchNetwork = (network) => {
    setCurrentNetwork(network);
    setIsTestnet(network === NETWORKS.TESTNET);
    localStorage.setItem('selectedNetwork', network);

    // Reload page to reinitialize connections with new network
    window.location.reload();
  };

  const value = {
    currentNetwork,
    isTestnet,
    endpoint,
    switchNetwork,
    isMainnet: currentNetwork === NETWORKS.MAINNET,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export default NetworkProvider;
