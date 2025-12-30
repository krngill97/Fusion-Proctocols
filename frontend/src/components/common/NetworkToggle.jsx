import { Globe, TestTube } from 'lucide-react';
import { useNetwork, NETWORKS } from '../../context/NetworkContext';
import toast from 'react-hot-toast';

const NetworkToggle = () => {
  const { currentNetwork, isTestnet, switchNetwork } = useNetwork();

  const handleSwitch = (network) => {
    if (network === currentNetwork) return;

    toast.loading('Switching network...', { id: 'network-switch' });

    setTimeout(() => {
      switchNetwork(network);
    }, 500);
  };

  return (
    <div className="flex items-center gap-2 bg-dark-900 rounded-lg p-1 border border-dark-800">
      <button
        onClick={() => handleSwitch(NETWORKS.MAINNET)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all
          ${!isTestnet
            ? 'bg-primary-600 text-white shadow-sm'
            : 'text-dark-400 hover:text-dark-300'
          }
        `}
      >
        <Globe size={14} />
        <span>Mainnet</span>
      </button>

      <button
        onClick={() => handleSwitch(NETWORKS.TESTNET)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all
          ${isTestnet
            ? 'bg-warning-600 text-white shadow-sm'
            : 'text-dark-400 hover:text-dark-300'
          }
        `}
      >
        <TestTube size={14} />
        <span>Testnet</span>
      </button>
    </div>
  );
};

export default NetworkToggle;
