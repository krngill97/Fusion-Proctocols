import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import wsService from '../../services/websocket';

/**
 * Live Price Header - Real-time Price Statistics
 *
 * Features:
 * - Current price with large display
 * - 24h price change (absolute and percentage)
 * - 24h high and low prices
 * - 24h volume (SOL and tokens)
 * - Total transactions count
 * - Real-time updates via WebSocket
 * - Color-coded indicators (green/red)
 */
const LivePriceHeader = ({ tokenMint, tokenInfo }) => {
  const [stats, setStats] = useState({
    currentPrice: 0,
    priceChange24h: 0,
    priceChangePercent24h: 0,
    high24h: 0,
    low24h: 0,
    volumeSOL24h: 0,
    volumeTokens24h: 0,
    transactions24h: 0,
  });

  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef(null);

  /**
   * Fetch 24h statistics from API
   */
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/charts/stats/${tokenMint}`);
      const data = await response.json();

      if (data.success) {
        setStats({
          currentPrice: data.currentPrice || 0,
          priceChange24h: data.priceChange24h || 0,
          priceChangePercent24h: data.priceChangePercent24h || 0,
          high24h: data.high24h || 0,
          low24h: data.low24h || 0,
          volumeSOL24h: data.volumeSOL24h || 0,
          volumeTokens24h: data.volumeTokens24h || 0,
          transactions24h: data.transactions24h || 0,
        });
      }
    } catch (err) {
      console.error('[Price Header] Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }, [tokenMint]);

  /**
   * Handle real-time trade updates
   */
  const handleTradeUpdate = useCallback((trade) => {
    if (trade.tokenMint !== tokenMint) return;

    setStats(prev => {
      const newStats = { ...prev };

      // Update current price
      newStats.currentPrice = trade.price;

      // Check if new 24h high or low
      if (trade.price > newStats.high24h) {
        newStats.high24h = trade.price;
      }
      if (trade.price < newStats.low24h || newStats.low24h === 0) {
        newStats.low24h = trade.price;
      }

      // Add to 24h volume
      newStats.volumeSOL24h += trade.volumeSOL || 0;
      newStats.volumeTokens24h += trade.tokenAmount || 0;

      // Increment transaction count
      newStats.transactions24h += 1;

      // Recalculate price change
      const priceChange = newStats.currentPrice - (prev.currentPrice - prev.priceChange24h);
      newStats.priceChange24h = priceChange;
      newStats.priceChangePercent24h = prev.currentPrice !== 0
        ? (priceChange / (prev.currentPrice - priceChange)) * 100
        : 0;

      return newStats;
    });
  }, [tokenMint]);

  /**
   * Setup WebSocket for real-time updates using shared service
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
   * Fetch initial stats
   */
  useEffect(() => {
    fetchStats();

    // Refresh stats every 30 seconds as backup
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  /**
   * Format price with appropriate decimals
   */
  const formatPrice = (price) => {
    if (price === 0) return '0.00000000';
    if (price < 0.00001) return price.toFixed(10);
    if (price < 0.01) return price.toFixed(8);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(4);
  };

  /**
   * Format large numbers with K/M/B suffix
   */
  const formatNumber = (num) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    const n = Number(num);
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K';
    return n.toFixed(2);
  };

  const isPriceUp = stats.priceChange24h > 0;
  const isPriceDown = stats.priceChange24h < 0;
  const isPriceFlat = stats.priceChange24h === 0;

  if (loading) {
    return (
      <div className="px-6 py-4 border-b border-dark-800 bg-dark-900">
        <div className="animate-pulse">
          <div className="h-8 bg-dark-700 rounded w-48 mb-2"></div>
          <div className="h-4 bg-dark-700 rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 border-b border-dark-800 bg-dark-900">
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        {/* Token Name & Current Price */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">
              {tokenInfo?.name || 'Unknown Token'}
            </h1>
            <span className="px-2 py-0.5 bg-dark-700 text-dark-300 text-xs rounded">
              {tokenInfo?.symbol || 'TOKEN'}
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-white tabular-nums">
              ${formatPrice(stats.currentPrice)}
            </span>
            <div className={`flex items-center gap-1 text-sm font-semibold ${
              isPriceUp ? 'text-success' :
              isPriceDown ? 'text-error' :
              'text-dark-400'
            }`}>
              {isPriceUp && <TrendingUp size={16} />}
              {isPriceDown && <TrendingDown size={16} />}
              {isPriceFlat && <Minus size={16} />}
              <span>
                {isPriceUp && '+'}
                {formatPrice(Math.abs(stats.priceChange24h))}
              </span>
              <span>
                ({isPriceUp && '+'}
                {stats.priceChangePercent24h.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* 24h High */}
        <div className="lg:border-l lg:border-dark-800 lg:pl-4">
          <div className="text-xs text-dark-500 mb-1">24h High</div>
          <div className="text-lg font-semibold text-success tabular-nums">
            ${formatPrice(stats.high24h)}
          </div>
        </div>

        {/* 24h Low */}
        <div className="lg:border-l lg:border-dark-800 lg:pl-4">
          <div className="text-xs text-dark-500 mb-1">24h Low</div>
          <div className="text-lg font-semibold text-error tabular-nums">
            ${formatPrice(stats.low24h)}
          </div>
        </div>

        {/* 24h Volume (SOL) */}
        <div className="lg:border-l lg:border-dark-800 lg:pl-4">
          <div className="text-xs text-dark-500 mb-1">24h Volume</div>
          <div className="text-lg font-semibold text-white tabular-nums">
            {formatNumber(stats.volumeSOL24h)} SOL
          </div>
        </div>

        {/* 24h Volume (Tokens) */}
        <div className="lg:border-l lg:border-dark-800 lg:pl-4">
          <div className="text-xs text-dark-500 mb-1">24h Volume (Tokens)</div>
          <div className="text-lg font-semibold text-white tabular-nums">
            {formatNumber(stats.volumeTokens24h)}
          </div>
        </div>

        {/* Transactions */}
        <div className="lg:border-l lg:border-dark-800 lg:pl-4">
          <div className="text-xs text-dark-500 mb-1">24h Transactions</div>
          <div className="text-lg font-semibold text-primary-400 tabular-nums">
            {stats.transactions24h.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePriceHeader;
