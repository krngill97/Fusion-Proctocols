import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { testnetTokenApi, testnetTradeApi } from '../services/api';
import PriceChart from '../components/charts/PriceChart';
import TransactionFeed from '../components/trading/TransactionFeed';
import PriceHeader from '../components/trading/PriceHeader';
import VolumeAnalysis from '../components/trading/VolumeAnalysis';

export default function TokenDetailPage() {
  const { mint } = useParams();
  const [token, setToken] = useState(null);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [priceChange24h, setPriceChange24h] = useState(0);

  useEffect(() => {
    loadTokenData();
    const interval = setInterval(loadTrades, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, [mint]);

  const loadTokenData = async () => {
    try {
      setLoading(true);

      // Load token info
      const tokenRes = await testnetTokenApi.getById(mint);
      if (tokenRes.data?.success) {
        setToken(tokenRes.data.data);
      }

      // Load stats
      const statsRes = await testnetTradeApi.getStats(mint);
      if (statsRes.data?.success) {
        setStats(statsRes.data.data);
      }

      // Load trades
      await loadTrades();

      setLoading(false);
    } catch (error) {
      console.error('Error loading token data:', error);
      setLoading(false);
    }
  };

  const loadTrades = async () => {
    try {
      const tradesRes = await testnetTradeApi.getRecent(mint, 50);
      if (tradesRes.data?.success) {
        setTrades(tradesRes.data.data || []);

        // Calculate 24h price change
        if (tradesRes.data.data?.length > 0) {
          const latestPrice = tradesRes.data.data[0].price;
          const oldestPrice = tradesRes.data.data[tradesRes.data.data.length - 1].price;
          const change = ((latestPrice - oldestPrice) / oldestPrice) * 100;
          setPriceChange24h(change);
        }
      }
    } catch (error) {
      console.error('Error loading trades:', error);
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

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const currentPrice = trades.length > 0 ? trades[0].price : 0;

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0e1117' }}
      >
        <div style={{ color: '#787b86' }}>Loading token data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0e1117' }}>
      {/* Price Header */}
      <PriceHeader tokenMint={mint} tokenInfo={token} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Chart and Transaction Feed Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column - Chart (2/3 width on desktop) */}
          <div className="lg:col-span-2">
            <PriceChart tokenMint={mint} height={600} />
          </div>

          {/* Right Column - Transaction Feed (1/3 width on desktop) */}
          <div className="lg:col-span-1">
            <TransactionFeed tokenMint={mint} maxHeight={600} />
          </div>
        </div>

        {/* Volume Analysis Section */}
        <div className="max-w-md">
          <VolumeAnalysis tokenMint={mint} />
        </div>
      </div>
    </div>
  );
}
