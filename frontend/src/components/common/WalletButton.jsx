import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Wallet, LogOut } from 'lucide-react';

const WalletButton = () => {
  const { publicKey, connected, disconnect } = useWallet();

  const shortenAddress = (address) => {
    if (!address) return '';
    const str = address.toString();
    return `${str.slice(0, 4)}...${str.slice(-4)}`;
  };

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-2">
        {/* Connected Wallet Display */}
        <div className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
          <Wallet size={16} className="text-primary-400" />
          <span className="text-sm font-mono text-white">
            {shortenAddress(publicKey)}
          </span>
          <button
            onClick={disconnect}
            className="ml-2 p-1 text-dark-400 hover:text-error transition-colors"
            title="Disconnect Wallet"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-adapter-button-container">
      <WalletMultiButton className="!bg-gradient-to-r !from-primary-500 !to-accent-purple !border-0 !rounded-lg !px-4 !py-2 !h-auto !text-sm !font-semibold hover:!opacity-90 !transition-opacity" />
    </div>
  );
};

export default WalletButton;
