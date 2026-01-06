import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

const TIMEFRAMES = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
];

export default function PriceChart({ tokenMint, height = 500 }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  const [timeframe, setTimeframe] = useState('1m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latestPrice, setLatestPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart with DEXScreener-style dark theme
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.6)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.6)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(224, 227, 235, 0.1)',
          width: 1,
          style: 0,
          labelBackgroundColor: '#363c4e',
        },
        horzLine: {
          color: 'rgba(224, 227, 235, 0.1)',
          width: 1,
          style: 0,
          labelBackgroundColor: '#363c4e',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.6)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.6)',
        timeVisible: true,
        secondsVisible: true,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
      },
    });

    chartRef.current = chart;

    // Create candlestick series with DEXScreener colors
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      },
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Create volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.7,
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

        console.log('Fetching chart data for:', tokenMint);
        const response = await fetch(`http://localhost:5001/api/charts/complete/${tokenMint}?timeframe=${timeframe}&limit=100`);
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Chart data:', data);

        if (data.success) {
          const { candles, latestPrice, priceChange24h } = data;

          // Update candlestick data
          if (candlestickSeriesRef.current && candles.length > 0) {
            candlestickSeriesRef.current.setData(candles);
          }

          // Update volume data with DEXScreener colors
          if (volumeSeriesRef.current && candles.length > 0) {
            const volumeData = candles.map((candle) => ({
              time: candle.time,
              value: candle.volume,
              color: candle.close >= candle.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
            }));
            volumeSeriesRef.current.setData(volumeData);
          }

          // Fit content
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }

          // Update latest price and change
          if (latestPrice) {
            setLatestPrice(latestPrice);
            setPriceChange(priceChange24h);
          }
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        setError(error.message || 'Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchChartData, 10000);

    return () => clearInterval(interval);
  }, [tokenMint, timeframe]);

  if (loading && !chartRef.current) {
    return (
      <div
        className="bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <div className="text-white">Loading chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col items-center justify-center gap-4 p-6"
        style={{ height: `${height}px` }}
      >
        <div className="text-red-400 text-center">
          <div className="text-lg font-semibold mb-2">Failed to load chart</div>
          <div className="text-sm text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#131722' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(42, 46, 57, 0.6)' }}>
        <div className="flex items-center gap-4">
          {/* Price Info */}
          <div>
            <div className="text-2xl font-bold" style={{ color: '#d1d4dc' }}>
              {latestPrice ? `$${(latestPrice.price * 100).toFixed(8)}` : 'Loading...'}
            </div>
            {priceChange && (
              <div
                className="text-sm font-medium"
                style={{ color: priceChange.changePercent >= 0 ? '#26a69a' : '#ef5350' }}
              >
                {priceChange.changePercent >= 0 ? '▲' : '▼'} {priceChange.changePercent >= 0 ? '+' : ''}
                {priceChange.changePercent.toFixed(2)}% (24h)
              </div>
            )}
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: '#1e222d' }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className="px-3 py-1.5 text-sm font-medium rounded transition-all duration-200"
              style={{
                backgroundColor: timeframe === tf.value ? '#2962ff' : 'transparent',
                color: timeframe === tf.value ? '#ffffff' : '#787b86',
              }}
              onMouseEnter={(e) => {
                if (timeframe !== tf.value) {
                  e.currentTarget.style.backgroundColor = 'rgba(42, 46, 57, 0.6)';
                }
              }}
              onMouseLeave={(e) => {
                if (timeframe !== tf.value) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: 'rgba(19, 23, 34, 0.8)' }}>
            <div style={{ color: '#d1d4dc' }}>Updating chart...</div>
          </div>
        )}
        <div ref={chartContainerRef} />
      </div>
    </div>
  );
}
