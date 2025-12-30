import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import api from '../../services/api';
import { Spinner } from '../common';

const TIMEFRAMES = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1D' },
];

export default function PriceChart({ tokenMint, height = 500 }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  const [timeframe, setTimeframe] = useState('5m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latestPrice, setLatestPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: '#1e293b' },
        textColor: '#cbd5e1',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Create volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#4f46e5',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [height]);

  // Fetch chart data
  useEffect(() => {
    if (!tokenMint) return;

    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get(`/charts/complete/${tokenMint}`, {
          params: {
            timeframe,
            limit: 100,
          },
        });

        if (response.data.success) {
          const { candles, latestPrice, priceChange24h } = response.data;

          // Update candlestick data
          if (candlestickSeriesRef.current && candles.length > 0) {
            candlestickSeriesRef.current.setData(candles);
          }

          // Update volume data
          if (volumeSeriesRef.current && candles.length > 0) {
            const volumeData = candles.map((candle) => ({
              time: candle.time,
              value: candle.volume,
              color: candle.close >= candle.open ? '#22c55e80' : '#ef444480',
            }));
            volumeSeriesRef.current.setData(volumeData);
          }

          // Fit content
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }

          // Update latest price and change
          setLatestPrice(latestPrice);
          setPriceChange(priceChange24h);
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        setError(error.message || 'Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();

    // Auto-refresh every minute
    const interval = setInterval(fetchChartData, 60000);

    return () => clearInterval(interval);
  }, [tokenMint, timeframe]);

  if (loading && !chartRef.current) {
    return (
      <div
        className="bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-slate-800 rounded-lg border border-slate-700 flex flex-col items-center justify-center gap-4 p-6"
        style={{ height: `${height}px` }}
      >
        <div className="text-red-400 text-center">
          <div className="text-lg font-semibold mb-2">Failed to load chart</div>
          <div className="text-sm text-slate-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Price Info */}
          {latestPrice && (
            <div>
              <div className="text-2xl font-bold text-white">
                {latestPrice.price.toFixed(6)} SOL
              </div>
              {priceChange && (
                <div
                  className={`text-sm ${
                    priceChange.changePercent >= 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {priceChange.changePercent >= 0 ? '+' : ''}
                  {priceChange.changePercent.toFixed(2)}% (24h)
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                timeframe === tf.value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10">
            <Spinner size="md" />
          </div>
        )}
        <div ref={chartContainerRef} />
      </div>
    </div>
  );
}
