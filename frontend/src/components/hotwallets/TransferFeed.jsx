import { ArrowUpRight, ExternalLink, Clock, Zap } from 'lucide-react';

const TransferFeed = ({ transfers }) => {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatAmount = (amount) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K`;
    }
    return amount?.toFixed(4) || '0';
  };

  const shortenAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Zap className="text-primary-400" size={18} />
          Live Transfers
        </h3>
        <span className="badge badge-success flex items-center gap-1">
          <span className="status-dot status-dot-success"></span>
          Live
        </span>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto no-scrollbar">
        {transfers.length === 0 ? (
          <div className="text-center py-8">
            <ArrowUpRight className="mx-auto text-dark-500 mb-2" size={24} />
            <p className="text-dark-400 text-sm">No transfers yet</p>
            <p className="text-dark-500 text-xs">Transfers will appear here in real-time</p>
          </div>
        ) : (
          transfers.map((transfer, index) => (
            <TransferItem key={transfer.signature || index} transfer={transfer} />
          ))
        )}
      </div>
    </div>
  );
};

const TransferItem = ({ transfer }) => {
  const formatAmount = (amount) => {
    if (!amount) return '0';
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K`;
    }
    return amount.toFixed(4);
  };

  const shortenAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  return (
    <div className="p-3 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600/20 rounded-full flex items-center justify-center">
            <ArrowUpRight className="text-primary-400" size={14} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {formatAmount(transfer.amount)} SOL
            </p>
            <p className="text-xs text-dark-400">
              {transfer.exchange || 'Unknown Exchange'}
            </p>
          </div>
        </div>
        <span className="text-xs text-dark-500 flex items-center gap-1">
          <Clock size={10} />
          {formatTime(transfer.timestamp || transfer.createdAt)}
        </span>
      </div>

      <div className="text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-dark-400">From:</span>
          <span className="font-mono text-dark-300">
            {shortenAddress(transfer.fromAddress || transfer.hotWalletAddress)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dark-400">To:</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-dark-300">
              {shortenAddress(transfer.toAddress)}
            </span>
            {transfer.signature && (
              <a
                href={`https://solscan.io/tx/${transfer.signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-dark-500 hover:text-primary-400"
              >
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>

      {transfer.isNewSubwallet && (
        <div className="mt-2 px-2 py-1 bg-accent-purple/20 rounded text-xs text-accent-purple">
          ✨ New subwallet detected
        </div>
      )}
    </div>
  );
};

export default TransferFeed;
