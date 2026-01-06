import React from 'react';

/**
 * Timeframe Selector Component
 *
 * Allows users to switch between different chart timeframes:
 * - 1m: 1 minute candles
 * - 5m: 5 minute candles
 * - 15m: 15 minute candles
 * - 1h: 1 hour candles
 * - 4h: 4 hour candles
 * - 1d: 1 day candles
 */
const TimeframeSelector = ({ selectedTimeframe, onTimeframeChange }) => {
  const timeframes = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '1h', label: '1h' },
    { value: '4h', label: '4h' },
    { value: '1d', label: '1d' },
  ];

  return (
    <div className="flex items-center gap-1 bg-dark-900 rounded-lg p-1">
      {timeframes.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onTimeframeChange(tf.value)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
            selectedTimeframe === tf.value
              ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
              : 'text-dark-400 hover:text-white hover:bg-dark-800'
          }`}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
};

export default TimeframeSelector;
