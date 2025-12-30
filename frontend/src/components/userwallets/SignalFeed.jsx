import { 
  Bell, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Droplets, 
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink, 
  Clock 
} from 'lucide-react';
import { Badge } from '../common';

const SignalFeed = ({ signals }) => {
  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Bell className="text-primary-400" size={18} />
          Signal Feed
        </h3>
        <Badge variant="success" dot>Live</Badge>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto no-scrollbar">
        {signals.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="mx-auto text-dark-500 mb-2" size={24} />
            <p className="text-dark-400 text-sm">No signals yet</p>
            <p className="text-dark-500 text-xs">Signals from tracked wallets appear here</p>
          </div>
        ) : (
          signals.map((signal, index) => (
            <SignalItem key={signal.txSignature || index} signal={signal} />
          ))
        )}
      </div>
    </div>
  );
};

const SignalItem = ({ signal }) => {
  const getSignalConfig = (type) => {
    const configs = {
      mint: { 
        icon: Zap, 
        color: 'purple', 
        label: 'Mint',
        bgColor: 'bg-accent-purple/20',
        textColor: 'text-accent-purple'
      },
      buy: { 
        icon: TrendingUp, 
        color: 'success', 
        label: 'Buy',
        bgColor: 'bg-success/20',
        textColor: 'text-success'
      },
      sell: { 
        icon: TrendingDown, 
        color: 'error', 
        label: 'Sell',
        bgColor: 'bg-error/20',
        textColor: 'text-error'
      },
      pool_created: { 
        icon: Droplets, 
        color: 'info', 
        label: 'Pool Created',
        bgColor: 'bg-info/20',
        textColor: 'text-info'
      },
      large_transfer: { 
        icon: ArrowUpRight, 
        color: 'warning', 
        label: 'Transfer',
        bgColor: 'bg-warning/20',
        textColor: 'text-warning'
      },
    };
    return configs[type] || { 
      icon: Bell, 
      color: 'default', 
      label: type,
      bgColor: 'bg-dark-700',
      textColor: 'text-dark-300'
    };
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const shortenAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const config = getSignalConfig(signal.signalType);
  const Icon = config.icon;

  return (
    <div className="p-3 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor}`}>
            <Icon className={config.textColor} size={14} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {signal.walletLabel || 'Tracked Wallet'}
            </p>
            <p className="text-xs text-dark-400">
              {config.label}
            </p>
          </div>
        </div>
        <Badge variant={config.color} size="sm">
          {(signal.confidence * 100).toFixed(0)}%
        </Badge>
      </div>

      {/* Signal Details */}
      <div className="text-xs space-y-1 mb-2">
        {signal.data?.tokenSymbol && (
          <div className="flex items-center justify-between">
            <span className="text-dark-400">Token:</span>
            <span className="text-white font-medium">{signal.data.tokenSymbol}</span>
          </div>
        )}
        {signal.data?.amount && (
          <div className="flex items-center justify-between">
            <span className="text-dark-400">Amount:</span>
            <span className="text-white">{signal.data.amount.toLocaleString()}</span>
          </div>
        )}
        {signal.data?.solAmount && (
          <div className="flex items-center justify-between">
            <span className="text-dark-400">SOL:</span>
            <span className="text-white">{signal.data.solAmount.toFixed(4)} SOL</span>
          </div>
        )}
        {signal.data?.direction && (
          <div className="flex items-center justify-between">
            <span className="text-dark-400">Direction:</span>
            <span className={signal.data.direction === 'incoming' ? 'text-success' : 'text-error'}>
              {signal.data.direction === 'incoming' ? (
                <span className="flex items-center gap-1"><ArrowDownRight size={12} /> Incoming</span>
              ) : (
                <span className="flex items-center gap-1"><ArrowUpRight size={12} /> Outgoing</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-dark-700">
        <span className="text-xs text-dark-500 flex items-center gap-1">
          <Clock size={10} />
          {formatTime(signal.timestamp)}
        </span>
        {signal.txSignature && (
          <a
            href={`https://solscan.io/tx/${signal.txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary-400 hover:underline flex items-center gap-1"
          >
            View TX <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
};

export default SignalFeed;
