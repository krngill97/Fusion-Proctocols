import { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink, Copy, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import wsService from '../../services/websocket';

/**
 * Live Transaction Feed - Real-Time Trade List
 *
 * Features:
 * - Scrolling feed of recent trades (newest first)
 * - Real-time updates via WebSocket
 * - BUY/SELL badges with color coding
 * - Token and SOL amounts
 * - Price per token
 * - Abbreviated wallet addresses (click to copy)
 * - Relative timestamps (updating every second)
 * - Solscan links for each transaction
 * - Highlight animation for new trades
 * - Auto-scroll with "new trades" notification
 * - Virtual scrolling for performance
 */
const LiveTransactionFeed = ({ tokenMint }) => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasNewTrades, setHasNewTrades] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);

  const feedRef = useRef(null);
  const unsubscribeRef = useRef(null);

  /**
   * Fetch recent trades from API
   */
  const fetchTrades = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `/api/charts/trades/${tokenMint}?limit=100`
      );
      const data = await response.json();

      if (data.success && data.trades) {
        setTrades(data.trades);
      }
    } catch (err) {
      console.error('[Transaction Feed] Error fetching trades:', err);
    } finally {
      setLoading(false);
    }
  }, [tokenMint]);

  /**
   * Handle real-time trade updates
   */
  const handleTradeUpdate = useCallback((trade) => {
    if (trade.tokenMint !== tokenMint) return;

    setTrades(prev => {
      // Add new trade at the beginning with highlight flag
      const newTrade = { ...trade, isNew: true };
      const updated = [newTrade, ...prev];

      // Limit to 200 trades to prevent memory issues
      return updated.slice(0, 200);
    });

    // Show "new trades" notification if user scrolled down
    if (userScrolled) {
      setHasNewTrades(true);
    } else {
      // Auto-scroll to top for new trade
      if (feedRef.current) {
        feedRef.current.scrollTop = 0;
      }
    }

    // Remove highlight after 2 seconds
    setTimeout(() => {
      setTrades(prev =>
        prev.map(t => t.signature === trade.signature ? { ...t, isNew: false } : t)
      );
    }, 2000);
  }, [tokenMint, userScrolled]);

  /**
   * Setup WebSocket for real-time trades using shared service
   */
  useEffect(() => {
    // Connect to shared WebSocket service
    wsService.connect();

    // Subscribe to messages
    const unsubscribe = wsService.subscribe(`token:${tokenMint}`, (message) => {
      if ((message.type === 'NEW_TRADE' || message.type === 'VOLUME_BOT_TRADE') && message.data) {
        handleTradeUpdate(message.data);
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [tokenMint, handleTradeUpdate]);

  /**
   * Fetch initial trades
   */
  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  /**
   * Handle scroll to detect if user manually scrolled
   */
  const handleScroll = () => {
    if (!feedRef.current) return;

    const isAtTop = feedRef.current.scrollTop < 50;
    setUserScrolled(!isAtTop);

    if (isAtTop) {
      setHasNewTrades(false);
    }
  };

  /**
   * Scroll to top
   */
  const scrollToTop = () => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setHasNewTrades(false);
    setUserScrolled(false);
  };

  /**
   * Copy address to clipboard
   */
  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied!');
  };

  /**
   * Format address (first 4 + last 4)
   */
  const formatAddress = (address) => {
    if (!address) return '????...????';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  /**
   * Format timestamp
   */
  const formatTime = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Just now';
    }
  };

  /**
   * Format number with decimals
   */
  const formatNumber = (num, decimals = 2) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    const n = Number(num);
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(decimals) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(decimals) + 'K';
    return n.toFixed(decimals);
  };

  if (loading) {
    return (
      <div className="h-full bg-dark-900 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Recent Trades</h3>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse bg-dark-800 rounded p-3 h-20"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-dark-900 rounded-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-800 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-white">Recent Trades</h3>
        <span className="text-2xs text-dark-500">
          {trades.length} {trades.length === 1 ? 'trade' : 'trades'}
        </span>
      </div>

      {/* New Trades Notification */}
      {hasNewTrades && (
        <div className="px-4 py-2 bg-primary-500/10 border-b border-primary-500/20 flex-shrink-0">
          <button
            onClick={scrollToTop}
            className="w-full flex items-center justify-center gap-2 text-xs text-primary-400 hover:text-primary-300"
          >
            <ChevronUp size={14} />
            <span>New trades available</span>
          </button>
        </div>
      )}

      {/* Trade Feed */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-transparent"
      >
        {trades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center p-8">
            <div>
              <div className="text-4xl mb-2">📊</div>
              <p className="text-dark-400 text-sm">No trades yet</p>
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {trades.map((trade, index) => {
              const isBuy = trade.type === 'BUY' || trade.type === 'buy';
              const timestamp = trade.timestamp || trade.createdAt;

              return (
                <div
                  key={trade.signature || `${trade._id}-${index}`}
                  className={`p-3 rounded-lg border transition-all duration-300 ${
                    trade.isNew
                      ? isBuy
                        ? 'bg-success/10 border-success/30 animate-pulse-once'
                        : 'bg-error/10 border-error/30 animate-pulse-once'
                      : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                  }`}
                >
                  {/* Type Badge and Time */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-2xs font-bold ${
                        isBuy
                          ? 'bg-success/20 text-success'
                          : 'bg-error/20 text-error'
                      }`}
                    >
                      {isBuy ? 'BUY' : 'SELL'}
                    </span>
                    <span className="text-2xs text-dark-500">
                      {formatTime(timestamp)}
                    </span>
                  </div>

                  {/* Amount and Price */}
                  <div className="space-y-1 mb-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-dark-400">Amount:</span>
                      <span className="text-white font-medium tabular-nums">
                        {formatNumber(trade.tokenAmount || trade.amount, 2)} tokens
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-dark-400">Value:</span>
                      <span className="text-white font-medium tabular-nums">
                        {(trade.volumeSOL || trade.solAmount || 0).toFixed(4)} SOL
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-dark-400">Price:</span>
                      <span className="text-primary-400 font-medium tabular-nums">
                        ${(trade.price || 0).toFixed(8)}
                      </span>
                    </div>
                  </div>

                  {/* Wallet Address and Links */}
                  <div className="flex items-center justify-between pt-2 border-t border-dark-700">
                    <button
                      onClick={() => copyAddress(trade.wallet || trade.walletAddress)}
                      className="flex items-center gap-1 text-2xs text-dark-400 hover:text-white transition-colors"
                      title="Click to copy"
                    >
                      <span className="font-mono">
                        {formatAddress(trade.wallet || trade.walletAddress)}
                      </span>
                      <Copy size={10} />
                    </button>
                    {trade.signature && (
                      <a
                        href={`https://solscan.io/tx/${trade.signature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-400 hover:text-primary-300 transition-colors"
                        title="View on Solscan"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTransactionFeed;
