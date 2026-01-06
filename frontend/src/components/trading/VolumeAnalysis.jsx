import { useEffect, useState } from 'react';

export default function VolumeAnalysis({ tokenMint }) {
  const [volumeData, setVolumeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenMint) return;

    loadVolumeData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(loadVolumeData, 10000);

    return () => clearInterval(interval);
  }, [tokenMint]);

  const loadVolumeData = async () => {
    try {
      const response = await fetch(`/api/charts/volume/${tokenMint}?period=24h`);
      const data = await response.json();

      if (data.success && data.data) {
        setVolumeData(data.data);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading volume data:', error);
      setLoading(false);
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

  if (loading) {
    return (
      <div
        className="rounded-lg p-6 flex items-center justify-center"
        style={{ backgroundColor: '#131722' }}
      >
        <div style={{ color: '#787b86' }}>Loading volume data...</div>
      </div>
    );
  }

  const buyRatio = volumeData?.buyRatio || 50;
  const sellRatio = 100 - buyRatio;

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
          Volume Analysis (24h)
        </h3>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Total Volume */}
        <div>
          <div className="text-xs mb-2" style={{ color: '#787b86' }}>
            Total Volume
          </div>
          <div className="text-2xl font-bold" style={{ color: '#d1d4dc' }}>
            {formatNumber(volumeData?.totalVolume || 0)} SOL
          </div>
          <div className="text-sm mt-1" style={{ color: '#787b86' }}>
            ${formatNumber((volumeData?.totalVolume || 0) * 100)} USD
          </div>
        </div>

        {/* Buy/Sell Volume Breakdown */}
        <div>
          <div className="text-xs mb-3" style={{ color: '#787b86' }}>
            Buy/Sell Distribution
          </div>

          {/* Visual Bar */}
          <div
            className="h-3 rounded-full overflow-hidden mb-3"
            style={{ backgroundColor: 'rgba(42, 46, 57, 0.6)' }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${buyRatio}%`,
                backgroundColor: '#26a69a',
              }}
            ></div>
          </div>

          {/* Buy/Sell Stats */}
          <div className="grid grid-cols-2 gap-4">
            {/* Buy Stats */}
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: 'rgba(38, 166, 154, 0.1)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: '#26a69a' }}
                ></div>
                <span className="text-sm font-medium" style={{ color: '#26a69a' }}>
                  BUY
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#787b86' }}>
                    Volume
                  </span>
                  <span className="text-sm font-semibold" style={{ color: '#d1d4dc' }}>
                    {formatNumber(volumeData?.buyVolume || 0)} SOL
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#787b86' }}>
                    Trades
                  </span>
                  <span className="text-sm font-semibold" style={{ color: '#d1d4dc' }}>
                    {volumeData?.buyCount || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#787b86' }}>
                    Ratio
                  </span>
                  <span className="text-sm font-bold" style={{ color: '#26a69a' }}>
                    {buyRatio.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Sell Stats */}
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: 'rgba(239, 83, 80, 0.1)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: '#ef5350' }}
                ></div>
                <span className="text-sm font-medium" style={{ color: '#ef5350' }}>
                  SELL
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#787b86' }}>
                    Volume
                  </span>
                  <span className="text-sm font-semibold" style={{ color: '#d1d4dc' }}>
                    {formatNumber(volumeData?.sellVolume || 0)} SOL
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#787b86' }}>
                    Trades
                  </span>
                  <span className="text-sm font-semibold" style={{ color: '#d1d4dc' }}>
                    {volumeData?.sellCount || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#787b86' }}>
                    Ratio
                  </span>
                  <span className="text-sm font-bold" style={{ color: '#ef5350' }}>
                    {sellRatio.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trading Activity */}
        <div>
          <div className="text-xs mb-3" style={{ color: '#787b86' }}>
            Trading Activity
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: 'rgba(42, 46, 57, 0.3)' }}
            >
              <div className="text-xs mb-1" style={{ color: '#787b86' }}>
                Total Trades
              </div>
              <div className="text-lg font-bold" style={{ color: '#d1d4dc' }}>
                {volumeData?.totalTrades || 0}
              </div>
            </div>
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: 'rgba(42, 46, 57, 0.3)' }}
            >
              <div className="text-xs mb-1" style={{ color: '#787b86' }}>
                Avg Trade Size
              </div>
              <div className="text-lg font-bold" style={{ color: '#d1d4dc' }}>
                {volumeData?.totalTrades > 0
                  ? formatNumber(volumeData.totalVolume / volumeData.totalTrades)
                  : '0'} SOL
              </div>
            </div>
          </div>
        </div>

        {/* Market Sentiment */}
        <div>
          <div className="text-xs mb-2" style={{ color: '#787b86' }}>
            Market Sentiment
          </div>
          <div
            className="p-4 rounded-lg text-center"
            style={{
              backgroundColor: buyRatio > 55 ? 'rgba(38, 166, 154, 0.1)' : buyRatio < 45 ? 'rgba(239, 83, 80, 0.1)' : 'rgba(42, 46, 57, 0.3)',
            }}
          >
            <div
              className="text-xl font-bold mb-1"
              style={{
                color: buyRatio > 55 ? '#26a69a' : buyRatio < 45 ? '#ef5350' : '#787b86',
              }}
            >
              {buyRatio > 55 ? '🟢 BULLISH' : buyRatio < 45 ? '🔴 BEARISH' : '⚪ NEUTRAL'}
            </div>
            <div className="text-xs" style={{ color: '#787b86' }}>
              {buyRatio > 55
                ? 'More buying pressure than selling'
                : buyRatio < 45
                ? 'More selling pressure than buying'
                : 'Balanced buy/sell activity'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
