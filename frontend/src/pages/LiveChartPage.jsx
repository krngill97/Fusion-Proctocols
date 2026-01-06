import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import TradingViewChart from '../components/charts/TradingViewChart';
import LivePriceHeader from '../components/charts/LivePriceHeader';
import LiveTransactionFeed from '../components/charts/LiveTransactionFeed';
import TimeframeSelector from '../components/charts/TimeframeSelector';
import toast from 'react-hot-toast';

/**
 * Live Chart Page - Professional Trading Chart with Real-Time Updates
 *
 * Features:
 * - Real-time candlestick chart using TradingView Lightweight Charts
 * - Live price updates via WebSocket
 * - Volume bars with candle color matching
 * - Transaction feed with real-time updates
 * - 24h statistics (volume, price change, high/low)
 * - Multiple timeframe support (1m, 5m, 15m, 1h, 4h, 1d)
 * - Mobile responsive with touch gestures
 * - Dark theme matching DEXScreener
 */
const LiveChartPage = () => {
  const { mint } = useParams();
  const navigate = useNavigate();

  const [tokenInfo, setTokenInfo] = useState(null);
  const [timeframe, setTimeframe] = useState('5m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch token information on mount
  useEffect(() => {
    if (!mint) {
      setError('No token mint address provided');
      setLoading(false);
      return;
    }

    fetchTokenInfo();
  }, [mint]);

  const fetchTokenInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`http://localhost:5001/api/testnet/tokens/${mint}`);
      const data = await response.json();

      if (data.success) {
        setTokenInfo(data.token);
      } else {
        setError('Token not found');
        toast.error('Failed to load token information');
      }
    } catch (err) {
      console.error('Error fetching token:', err);
      setError('Failed to load token data');
      toast.error('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-dark-400">Loading chart...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !tokenInfo) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="text-error mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Chart</h2>
          <p className="text-dark-400 mb-6">{error || 'Token not found'}</p>
          <button
            onClick={() => navigate('/tokens')}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded transition-colors"
          >
            Back to Tokens
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0D0D0D] overflow-hidden">
      {/* Back Button */}
      <div className="px-4 py-3 border-b border-dark-800">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">Back</span>
        </button>
      </div>

      {/* Live Price Header */}
      <LivePriceHeader
        tokenMint={mint}
        tokenInfo={tokenInfo}
      />

      {/* Chart and Feed Container */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 overflow-hidden">
        {/* Chart Section */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Timeframe Selector */}
          <TimeframeSelector
            selectedTimeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />

          {/* Trading View Chart */}
          <div className="flex-1 mt-3 min-h-0">
            <TradingViewChart
              tokenMint={mint}
              timeframe={timeframe}
              tokenInfo={tokenInfo}
            />
          </div>
        </div>

        {/* Transaction Feed - Right Side Panel */}
        <div className="lg:w-96 flex flex-col min-h-0">
          <LiveTransactionFeed tokenMint={mint} />
        </div>
      </div>
    </div>
  );
};

export default LiveChartPage;
