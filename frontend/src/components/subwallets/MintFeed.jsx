import { Zap, ExternalLink, Clock, TrendingUp } from 'lucide-react';
import { Badge } from '../common';

const MintFeed = ({ mints }) => {
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

  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Zap className="text-accent-purple" size={18} />
          Recent Mints
        </h3>
        <Badge variant="purple" dot>Live</Badge>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto no-scrollbar">
        {mints.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="mx-auto text-dark-500 mb-2" size={24} />
            <p className="text-dark-400 text-sm">No mints yet</p>
            <p className="text-dark-500 text-xs">New token mints will appear here</p>
          </div>
        ) : (
          mints.map((mint, index) => (
            <MintItem key={mint.txSignature || index} mint={mint} />
          ))
        )}
      </div>
    </div>
  );
};

const MintItem = ({ mint }) => {
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

  return (
    <div className="p-3 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent-purple/20 rounded-full flex items-center justify-center">
            <Zap className="text-accent-purple" size={14} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {mint.tokenSymbol || 'New Token'}
            </p>
            <p className="text-xs text-dark-400">
              {mint.tokenName || 'Unknown'}
            </p>
          </div>
        </div>
        <Badge variant="purple" size="sm">{mint.platform || 'Unknown'}</Badge>
      </div>

      <div className="text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-dark-400">Mint:</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-dark-300">
              {shortenAddress(mint.mintAddress || mint.tokenMint)}
            </span>
            {(mint.mintAddress || mint.tokenMint) && (
              <a
                href={`https://solscan.io/token/${mint.mintAddress || mint.tokenMint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-dark-500 hover:text-primary-400"
              >
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dark-400">From:</span>
          <span className="font-mono text-dark-300">
            {shortenAddress(mint.subwalletAddress)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-700">
        <span className="text-xs text-dark-500 flex items-center gap-1">
          <Clock size={10} />
          {formatTime(mint.timestamp || mint.createdAt)}
        </span>
        {mint.txSignature && (
          <a
            href={`https://solscan.io/tx/${mint.txSignature}`}
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

export default MintFeed;
