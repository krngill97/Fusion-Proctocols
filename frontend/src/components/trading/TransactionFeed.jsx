import { useEffect, useState, useRef } from 'react';

export default function TransactionFeed({ tokenMint, maxHeight = 600 }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!tokenMint) return;

    loadTrades();

    // Auto-refresh every 3 seconds
    const interval = setInterval(loadTrades, 3000);

    return () => clearInterval(interval);
  }, [tokenMint]);

  const loadTrades = async () => {
    try {
      const response = await fetch(`/api/testnet/trades/${tokenMint}/recent?limit=100`);
      const data = await response.json();

      if (data.success && data.trades) {
        setTrades(data.trades);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading trades:', error);
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num < 0.000001) return num.toFixed(10);
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toFixed(2);
    if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
    return (num / 1000000).toFixed(2) + 'M';
  };

  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  };

  if (loading) {
    return (
      <div
        className="rounded-lg p-6 flex items-center justify-center"
        style={{ backgroundColor: '#131722', height: `${maxHeight}px` }}
      >
        <div style={{ color: '#787b86' }}>Loading transactions...</div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: '#131722' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: 'rgba(42, 46, 57, 0.6)' }}
      >
        <h3 className="text-lg font-semibold" style={{ color: '#d1d4dc' }}>
          Live Transactions
        </h3>
        <p className="text-sm mt-1" style={{ color: '#787b86' }}>
          {trades.length} recent trades
        </p>
      </div>

      {/* Transaction List */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {trades.length === 0 ? (
          <div className="p-8 text-center" style={{ color: '#787b86' }}>
            <div className="mb-2">No transactions yet</div>
            <div className="text-sm">Trades will appear here in real-time</div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(42, 46, 57, 0.3)' }}>
            {trades.map((trade, index) => (
              <div
                key={trade.signature || `trade-${index}`}
                className="px-4 py-3 hover:bg-opacity-50 transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(42, 46, 57, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Type Badge */}
                  <div className="flex-shrink-0">
                    <span
                      className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide"
                      style={{
                        backgroundColor: trade.type === 'buy' ? 'rgba(38, 166, 154, 0.2)' : 'rgba(239, 83, 80, 0.2)',
                        color: trade.type === 'buy' ? '#26a69a' : '#ef5350',
                      }}
                    >
                      {trade.type}
                    </span>
                  </div>

                  {/* Trade Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium" style={{ color: '#d1d4dc' }}>
                          {formatNumber(trade.tokenAmount)}
                        </span>
                        <span className="text-xs" style={{ color: '#787b86' }}>tokens</span>
                      </div>
                      <span className="font-mono text-sm" style={{ color: '#787b86' }}>
                        {trade.solAmount?.toFixed(4)} SOL
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#787b86' }}>
                        <span>${(trade.price * 100).toFixed(8)}</span>
                        <span>•</span>
                        <a
                          href={`https://solscan.io/account/${trade.wallet}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                          style={{ color: '#2962ff' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {truncateAddress(trade.wallet)}
                        </a>
                      </div>
                      <span className="text-xs" style={{ color: '#787b86' }}>
                        {formatTime(trade.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Solscan Link */}
                  <div className="flex-shrink-0">
                    <a
                      href={`https://solscan.io/tx/${trade.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded transition-colors"
                      style={{ color: '#787b86' }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(42, 46, 57, 0.6)';
                        e.currentTarget.style.color = '#2962ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#787b86';
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
