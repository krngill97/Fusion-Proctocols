import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { WifiOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import wsService from '../../services/websocket';

/**
 * TradingView Chart Component - Real-Time Candlestick Chart
 *
 * Features:
 * - Professional candlestick chart with TradingView Lightweight Charts
 * - Real-time candle updates via WebSocket
 * - Volume bars colored to match candles
 * - Automatic price scaling
 * - Crosshair with OHLCV tooltip
 * - Zoom and pan functionality
 * - Dark theme matching DEXScreener
 */
const TradingViewChart = ({ tokenMint, timeframe, tokenInfo }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const unsubscribeRef = useRef(null);

  const [wsConnected, setWsConnected] = useState(false);
  const [candlesData, setCandlesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active candle that updates in real-time
  const activeCandle = useRef(null);

  // Timeframe to milliseconds mapping
  const timeframeToMs = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };

  /**
   * Initialize the chart with TradingView Lightweight Charts
   */
  const initializeChart = useCallback(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { color: '#0D0D0D' },
        textColor: '#D1D4DC',
      },
      grid: {
        vertLines: { color: '#1E222D' },
        horzLines: { color: '#1E222D' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#758696',
          width: 1,
          style: 3,
          labelBackgroundColor: '#2962FF',
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: 3,
          labelBackgroundColor: '#2962FF',
        },
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Create volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  /**
   * Fetch historical candle data from API
   */
  const fetchCandles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/charts/ohlcv/${tokenMint}?timeframe=${timeframe}&limit=200`
      );
      const data = await response.json();

      if (data.success && data.candles && data.candles.length > 0) {
        // Convert API data to chart format
        const formattedCandles = data.candles.map(candle => ({
          time: candle.time, // Already in Unix timestamp format
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        }));

        setCandlesData(formattedCandles);

        // Set the active candle to the most recent one
        if (formattedCandles.length > 0) {
          activeCandle.current = { ...formattedCandles[formattedCandles.length - 1] };
        }
      } else {
        setCandlesData([]);
      }
    } catch (err) {
      console.error('Error fetching candles:', err);
      setError('Failed to load chart data');
      toast.error('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  }, [tokenMint, timeframe]);

  /**
   * Update chart with candle data
   */
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    if (candlesData.length > 0) {
      candlestickSeriesRef.current.setData(candlesData);

      // Set volume data with matching colors
      const volumeData = candlesData.map(candle => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? '#26a69a' : '#ef5350',
      }));
      volumeSeriesRef.current.setData(volumeData);

      // Fit content to view
      chartRef.current.timeScale().fitContent();
    }
  }, [candlesData]);

  /**
   * Handle real-time trade updates from WebSocket
   */
  const handleTradeUpdate = useCallback((trade) => {
    if (trade.tokenMint !== tokenMint) return;

    const tradeTime = Math.floor(new Date(trade.timestamp).getTime() / 1000);
    const price = trade.price;
    const volume = trade.volumeSOL;

    const timeframeMs = timeframeToMs[timeframe];
    const candleStartTime = Math.floor(tradeTime / (timeframeMs / 1000)) * (timeframeMs / 1000);

    // If we have an active candle and this trade belongs to it
    if (activeCandle.current && activeCandle.current.time === candleStartTime) {
      // Update the active candle
      activeCandle.current.high = Math.max(activeCandle.current.high, price);
      activeCandle.current.low = Math.min(activeCandle.current.low, price);
      activeCandle.current.close = price;
      activeCandle.current.volume += volume;

      // Update the chart
      if (candlestickSeriesRef.current && volumeSeriesRef.current) {
        candlestickSeriesRef.current.update(activeCandle.current);
        volumeSeriesRef.current.update({
          time: activeCandle.current.time,
          value: activeCandle.current.volume,
          color: activeCandle.current.close >= activeCandle.current.open ? '#26a69a' : '#ef5350',
        });
      }
    } else {
      // New candle period - create a new candle
      const newCandle = {
        time: candleStartTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volume,
      };

      activeCandle.current = newCandle;

      // Add to chart
      if (candlestickSeriesRef.current && volumeSeriesRef.current) {
        candlestickSeriesRef.current.update(newCandle);
        volumeSeriesRef.current.update({
          time: newCandle.time,
          value: newCandle.volume,
          color: '#26a69a',
        });
      }

      // Add to local data
      setCandlesData(prev => [...prev, newCandle]);
    }
  }, [tokenMint, timeframe, timeframeToMs]);

  /**
   * Setup WebSocket connection for real-time updates using shared service
   */
  useEffect(() => {
    // Connect to shared WebSocket service
    wsService.connect();

    // Subscribe to messages
    const unsubscribe = wsService.subscribe(`token:${tokenMint}`, (message) => {
      if (message.type === 'connected') {
        setWsConnected(message.data);
      } else if ((message.type === 'NEW_TRADE' || message.type === 'VOLUME_BOT_TRADE') && message.data) {
        handleTradeUpdate(message.data);
      }
    });

    unsubscribeRef.current = unsubscribe;

    // Fallback: Poll for updates every 30 seconds
    const pollInterval = setInterval(() => {
      if (!wsService.isConnected()) {
        fetchCandles();
      }
    }, 30000);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      clearInterval(pollInterval);
    };
  }, [tokenMint, handleTradeUpdate, fetchCandles]);

  /**
   * Initialize chart on mount
   */
  useEffect(() => {
    initializeChart();
  }, [initializeChart]);

  /**
   * Fetch candles when timeframe or token changes
   */
  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="w-full h-full bg-[#0D0D0D] rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-dark-700 rounded w-48 mx-auto"></div>
            <div className="h-4 bg-dark-700 rounded w-32 mx-auto"></div>
          </div>
          <p className="text-dark-500 text-sm mt-4">Loading chart data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-full bg-[#0D0D0D] rounded-lg flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="text-error mx-auto mb-4" />
          <p className="text-error mb-2">Failed to load chart</p>
          <button
            onClick={fetchCandles}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state - no trades yet
  if (candlesData.length === 0) {
    return (
      <div className="w-full h-full bg-[#0D0D0D] rounded-lg flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-bold text-white mb-2">No Trading Activity Yet</h3>
          <p className="text-dark-400 mb-4">
            This token hasn't had any trades yet. Start trading to see the chart come alive!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* WebSocket Connection Indicator */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-1.5 bg-dark-900/90 rounded text-xs backdrop-blur">
        {wsConnected ? (
          <>
            <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
            <span className="text-success">Live</span>
          </>
        ) : (
          <>
            <WifiOff size={12} className="text-warning" />
            <span className="text-warning">Reconnecting...</span>
          </>
        )}
      </div>

      {/* Chart Container */}
      <div
        ref={chartContainerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
};

export default TradingViewChart;
