import { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  Bell,
  Zap,
  TrendingUp,
  TrendingDown,
  Droplets,
  ArrowUpRight,
  Copy,
  Check,
  Clock,
  Filter
} from 'lucide-react';
import { userWalletApi } from '../../services/api';
import { Badge } from '../common';
import toast from 'react-hot-toast';

const WalletSignals = ({ wallet, onClose }) => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSignals();
  }, [wallet._id, filter]);

  const fetchSignals = async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (filter !== 'all') {
        params.type = filter;
      }
      const response = await userWalletApi.getSignals(wallet._id, params);
      setSignals(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load signals');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Address copied');
  };

  const shortenAddress = (addr) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  const signalTypes = [
    { value: 'all', label: 'All Signals' },
    { value: 'mint', label: 'Mints' },
    { value: 'buy', label: 'Buys' },
    { value: 'sell', label: 'Sells' },
    { value: 'pool_created', label: 'Pools' },
    { value: 'large_transfer', label: 'Transfers' },
  ];

  return (
    <>
      {/* Overlay */}
      <div className="modal-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="modal-content max-w-2xl">
        {/* Header */}
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">
                {wallet.label || 'Wallet Signals'}
              </h2>
              <div className="flex items-center gap-2">
                <span className="font-mono text-dark-300">{shortenAddress(wallet.address)}</span>
                <button onClick={handleCopy} className="text-dark-400 hover:text-white">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <a
                  href={`https://solscan.io/account/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dark-400 hover:text-primary-400"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-dark-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Filter */}
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-dark-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="input w-40 py-1.5 text-sm"
              >
                {signalTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <span className="text-sm text-dark-400">
                {signals.length} signal{signals.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="spinner mx-auto"></div>
            </div>
          ) : signals.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="mx-auto text-dark-500 mb-2" size={32} />
              <p className="text-dark-400">No signals found</p>
              <p className="text-dark-500 text-sm">
                {filter !== 'all' ? 'Try a different filter' : 'Signals will appear as this wallet transacts'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {signals.map((signal, index) => (
                <SignalRow key={signal.txSignature || index} signal={signal} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const SignalRow = ({ signal }) => {
  const getSignalConfig = (type) => {
    const configs = {
      mint: { icon: Zap, color: 'purple', label: 'Mint' },
      buy: { icon: TrendingUp, color: 'success', label: 'Buy' },
      sell: { icon: TrendingDown, color: 'error', label: 'Sell' },
      pool_created: { icon: Droplets, color: 'info', label: 'Pool' },
      large_transfer: { icon: ArrowUpRight, color: 'warning', label: 'Transfer' },
    };
    return configs[type] || { icon: Bell, color: 'default', label: type };
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const config = getSignalConfig(signal.signalType);
  const Icon = config.icon;

  return (
    <div className="p-4 bg-dark-800 rounded-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            config.color === 'purple' ? 'bg-accent-purple/20' :
            config.color === 'success' ? 'bg-success/20' :
            config.color === 'error' ? 'bg-error/20' :
            config.color === 'info' ? 'bg-info/20' :
            config.color === 'warning' ? 'bg-warning/20' :
            'bg-dark-700'
          }`}>
            <Icon className={
              config.color === 'purple' ? 'text-accent-purple' :
              config.color === 'success' ? 'text-success' :
              config.color === 'error' ? 'text-error' :
              config.color === 'info' ? 'text-info' :
              config.color === 'warning' ? 'text-warning' :
              'text-dark-400'
            } size={18} />
          </div>
          <div>
            <p className="font-medium text-white">{config.label}</p>
            <p className="text-xs text-dark-400 flex items-center gap-1">
              <Clock size={10} />
              {formatTime(signal.timestamp)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.color}>
            {(signal.confidence * 100).toFixed(0)}% confidence
          </Badge>
        </div>
      </div>

      {/* Signal Data */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {signal.data?.tokenSymbol && (
          <div>
            <span className="text-dark-400">Token:</span>
            <span className="text-white ml-2">{signal.data.tokenSymbol}</span>
          </div>
        )}
        {signal.data?.amount && (
          <div>
            <span className="text-dark-400">Amount:</span>
            <span className="text-white ml-2">{signal.data.amount.toLocaleString()}</span>
          </div>
        )}
        {signal.data?.solAmount && (
          <div>
            <span className="text-dark-400">SOL:</span>
            <span className="text-white ml-2">{signal.data.solAmount.toFixed(4)}</span>
          </div>
        )}
        {signal.data?.pricePerToken && (
          <div>
            <span className="text-dark-400">Price:</span>
            <span className="text-white ml-2">{signal.data.pricePerToken.toFixed(8)}</span>
          </div>
        )}
        {signal.data?.mint && (
          <div className="col-span-2">
            <span className="text-dark-400">Mint:</span>
            <span className="font-mono text-xs text-dark-300 ml-2">
              {signal.data.mint.slice(0, 20)}...
            </span>
          </div>
        )}
      </div>

      {/* Transaction Link */}
      {signal.txSignature && (
        <div className="mt-3 pt-3 border-t border-dark-700">
          <a
            href={`https://solscan.io/tx/${signal.txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-400 hover:underline flex items-center gap-1"
          >
            View Transaction <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
};

export default WalletSignals;
