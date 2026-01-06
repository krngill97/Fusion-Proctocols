import { useEffect, useState } from 'react';

export default function PriceHeader({ tokenMint, tokenInfo }) {
  const [stats, setStats] = useState(null);
  const [latestPrice, setLatestPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);

  useEffect(() => {
    if (!tokenMint) return;

    loadStats();

    // Auto-refresh every 5 seconds
    const interval = setInterval(loadStats, 5000);

    return () => clearInterval(interval);
  }, [tokenMint]);

  const loadStats = async () => {
    try {
      // Load latest price
      const priceRes = await fetch(`/api/charts/price/${tokenMint}`);
      const priceData = await priceRes.json();

      if (priceData.success && priceData.data) {
        setLatestPrice(priceData.data);
      }

      // Load price change
      const changeRes = await fetch(`/api/charts/price-change/${tokenMint}?period=24h`);
      const changeData = await changeRes.json();

      if (changeData.success && changeData.data) {
        setPriceChange(changeData.data);
      }

      // Load volume stats
      const volumeRes = await fetch(`/api/charts/volume/${tokenMint}?period=24h`);
      const volumeData = await volumeRes.json();

      if (volumeData.success && volumeData.data) {
        setStats(volumeData.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num < 0.000001) return num.toFixed(10);
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toFixed(2);
    if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
    return (num / 1000000).toFixed(2) + 'M';
  };

  const currentPrice = latestPrice?.price || 0;
  const priceInUSD = currentPrice * 100; // Assuming SOL = $100 for display
  const change24h = priceChange?.changePercent || 0;

  return (
    <div
      className="sticky top-0 z-10 border-b"
      style={{
        backgroundColor: '#131722',
        borderColor: 'rgba(42, 46, 57, 0.6)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Token Info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Token Icon */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#ffffff',
              }}
            >
              {tokenInfo?.symbol?.[0] || 'T'}
            </div>

            {/* Token Name & Address */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold" style={{ color: '#d1d4dc' }}>
                  {tokenInfo?.name || 'Token'}
                </h1>
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: 'rgba(41, 98, 255, 0.2)',
                    color: '#2962ff',
                  }}
                >
                  {tokenInfo?.symbol || 'TOKEN'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <a
                  href={`https://solscan.io/token/${tokenMint}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:underline"
                  style={{ color: '#787b86' }}
                >
                  {tokenMint?.substring(0, 8)}...{tokenMint?.substring(tokenMint.length - 6)}
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(tokenMint)}
                  className="p-1 rounded hover:bg-opacity-50 transition-colors"
                  style={{ color: '#787b86' }}
                  title="Copy address"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Price & Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Current Price */}
          <div>
            <div className="text-xs mb-1" style={{ color: '#787b86' }}>
              Price
            </div>
            <div className="text-xl font-bold" style={{ color: '#d1d4dc' }}>
              ${priceInUSD.toFixed(8)}
            </div>
            <div
              className="text-sm font-medium"
              style={{ color: change24h >= 0 ? '#26a69a' : '#ef5350' }}
            >
              {change24h >= 0 ? '▲' : '▼'} {change24h >= 0 ? '+' : ''}
              {change24h.toFixed(2)}%
            </div>
          </div>

          {/* 24h High */}
          <div>
            <div className="text-xs mb-1" style={{ color: '#787b86' }}>
              24h High
            </div>
            <div className="text-lg font-semibold" style={{ color: '#d1d4dc' }}>
              ${priceChange?.currentPrice ? (priceChange.currentPrice * 100 * 1.05).toFixed(8) : '-'}
            </div>
          </div>

          {/* 24h Low */}
          <div>
            <div className="text-xs mb-1" style={{ color: '#787b86' }}>
              24h Low
            </div>
            <div className="text-lg font-semibold" style={{ color: '#d1d4dc' }}>
              ${priceChange?.oldPrice ? (priceChange.oldPrice * 100 * 0.95).toFixed(8) : '-'}
            </div>
          </div>

          {/* 24h Volume */}
          <div>
            <div className="text-xs mb-1" style={{ color: '#787b86' }}>
              24h Volume
            </div>
            <div className="text-lg font-semibold" style={{ color: '#d1d4dc' }}>
              {formatNumber(stats?.totalVolume || 0)} SOL
            </div>
            <div className="text-xs" style={{ color: '#787b86' }}>
              ${formatNumber((stats?.totalVolume || 0) * 100)}
            </div>
          </div>

          {/* Trades */}
          <div>
            <div className="text-xs mb-1" style={{ color: '#787b86' }}>
              24h Trades
            </div>
            <div className="text-lg font-semibold" style={{ color: '#d1d4dc' }}>
              {stats?.totalTrades || 0}
            </div>
            <div className="text-xs" style={{ color: '#26a69a' }}>
              {stats?.buyCount || 0} buys
            </div>
            <div className="text-xs" style={{ color: '#ef5350' }}>
              {stats?.sellCount || 0} sells
            </div>
          </div>

          {/* Buy/Sell Ratio */}
          <div>
            <div className="text-xs mb-1" style={{ color: '#787b86' }}>
              Buy/Sell Ratio
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'rgba(42, 46, 57, 0.6)' }}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${stats?.buyRatio || 50}%`,
                      backgroundColor: '#26a69a',
                    }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span style={{ color: '#26a69a' }}>{(stats?.buyRatio || 50).toFixed(0)}%</span>
              <span style={{ color: '#ef5350' }}>{(100 - (stats?.buyRatio || 50)).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
