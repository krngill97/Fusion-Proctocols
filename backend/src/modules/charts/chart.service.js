/**
 * Chart Service
 * Aggregates trade data into OHLCV candles for chart visualization
 */

import TestnetTrade from '../testnet-tokens/testnet-trade.model.js';

// Timeframe configurations in milliseconds
const TIMEFRAMES = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

class ChartService {
  /**
   * Get OHLCV candles for a token
   * @param {string} tokenMint - Token mint address
   * @param {string} timeframe - Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
   * @param {number} limit - Number of candles to return
   * @returns {Promise<Array>} Array of OHLCV candles
   */
  async getOHLCV(tokenMint, timeframe = '5m', limit = 100) {
    try {
      if (!TIMEFRAMES[timeframe]) {
        throw new Error(`Invalid timeframe: ${timeframe}. Valid options: ${Object.keys(TIMEFRAMES).join(', ')}`);
      }

      const timeframeMs = TIMEFRAMES[timeframe];
      const startTime = new Date(Date.now() - timeframeMs * limit);

      // Fetch all confirmed trades for the token within the time range
      const trades = await TestnetTrade.find({
        tokenMint,
        status: 'confirmed',
        timestamp: { $gte: startTime }
      })
      .select('price solAmount timestamp type')
      .sort({ timestamp: 1 })
      .lean();

      if (!trades || trades.length === 0) {
        return [];
      }

      // Group trades into candles by timeframe
      const candles = this.aggregateTradesIntoCandles(trades, timeframeMs, limit);

      return candles;

    } catch (error) {
      console.error('[Chart Service] Error generating OHLCV:', error);
      throw error;
    }
  }

  /**
   * Aggregate trades into OHLCV candles
   * @param {Array} trades - Array of trade objects
   * @param {number} timeframeMs - Timeframe in milliseconds
   * @param {number} limit - Maximum number of candles
   * @returns {Array} Array of OHLCV candles
   */
  aggregateTradesIntoCandles(trades, timeframeMs, limit) {
    if (trades.length === 0) return [];

    const candlesMap = new Map();

    // Group trades by time bucket
    trades.forEach(trade => {
      const timestamp = new Date(trade.timestamp).getTime();
      const bucketTime = Math.floor(timestamp / timeframeMs) * timeframeMs;

      if (!candlesMap.has(bucketTime)) {
        candlesMap.set(bucketTime, {
          time: Math.floor(bucketTime / 1000), // Unix timestamp in seconds (required by lightweight-charts)
          open: trade.price,
          high: trade.price,
          low: trade.price,
          close: trade.price,
          volume: 0,
          trades: 0
        });
      }

      const candle = candlesMap.get(bucketTime);

      // Update OHLC
      candle.high = Math.max(candle.high, trade.price);
      candle.low = Math.min(candle.low, trade.price);
      candle.close = trade.price; // Last trade in bucket

      // Update volume (in SOL)
      candle.volume += trade.solAmount || 0;
      candle.trades += 1;
    });

    // Convert map to sorted array
    let candles = Array.from(candlesMap.values())
      .sort((a, b) => a.time - b.time);

    // Fill gaps with previous close if needed
    candles = this.fillGaps(candles, timeframeMs);

    // Limit to requested number of candles
    if (candles.length > limit) {
      candles = candles.slice(-limit);
    }

    return candles;
  }

  /**
   * Fill gaps in candles with previous close
   * @param {Array} candles - Array of candles
   * @param {number} timeframeMs - Timeframe in milliseconds
   * @returns {Array} Array of candles with gaps filled
   */
  fillGaps(candles, timeframeMs) {
    if (candles.length <= 1) return candles;

    const filled = [];
    const timeframeSeconds = timeframeMs / 1000;

    for (let i = 0; i < candles.length; i++) {
      filled.push(candles[i]);

      // Check if there's a gap to the next candle
      if (i < candles.length - 1) {
        const currentTime = candles[i].time;
        const nextTime = candles[i + 1].time;
        const expectedNextTime = currentTime + timeframeSeconds;

        // Fill gaps with flat candles (OHLC all equal to previous close)
        let gapTime = expectedNextTime;
        while (gapTime < nextTime) {
          filled.push({
            time: gapTime,
            open: candles[i].close,
            high: candles[i].close,
            low: candles[i].close,
            close: candles[i].close,
            volume: 0,
            trades: 0
          });
          gapTime += timeframeSeconds;
        }
      }
    }

    return filled;
  }

  /**
   * Get latest price for a token
   * @param {string} tokenMint - Token mint address
   * @returns {Promise<Object>} Latest price data
   */
  async getLatestPrice(tokenMint) {
    try {
      const latestTrade = await TestnetTrade.findOne({
        tokenMint,
        status: 'confirmed'
      })
      .sort({ timestamp: -1 })
      .select('price solAmount tokenAmount timestamp type')
      .lean();

      if (!latestTrade) {
        return null;
      }

      return {
        price: latestTrade.price,
        timestamp: latestTrade.timestamp,
        type: latestTrade.type,
        solAmount: latestTrade.solAmount,
        tokenAmount: latestTrade.tokenAmount
      };

    } catch (error) {
      console.error('[Chart Service] Error getting latest price:', error);
      throw error;
    }
  }

  /**
   * Get price change for a token
   * @param {string} tokenMint - Token mint address
   * @param {string} period - Period (24h, 7d, 30d)
   * @returns {Promise<Object>} Price change data
   */
  async getPriceChange(tokenMint, period = '24h') {
    try {
      const periodMap = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const periodMs = periodMap[period] || periodMap['24h'];
      const startTime = new Date(Date.now() - periodMs);

      const [latestTrade, oldestTrade] = await Promise.all([
        TestnetTrade.findOne({ tokenMint, status: 'confirmed' })
          .sort({ timestamp: -1 })
          .select('price')
          .lean(),
        TestnetTrade.findOne({
          tokenMint,
          status: 'confirmed',
          timestamp: { $gte: startTime }
        })
          .sort({ timestamp: 1 })
          .select('price')
          .lean()
      ]);

      if (!latestTrade || !oldestTrade) {
        return { change: 0, changePercent: 0 };
      }

      const change = latestTrade.price - oldestTrade.price;
      const changePercent = (change / oldestTrade.price) * 100;

      return {
        currentPrice: latestTrade.price,
        oldPrice: oldestTrade.price,
        change,
        changePercent
      };

    } catch (error) {
      console.error('[Chart Service] Error calculating price change:', error);
      throw error;
    }
  }

  /**
   * Get volume data for a token
   * @param {string} tokenMint - Token mint address
   * @param {string} period - Period (24h, 7d, 30d)
   * @returns {Promise<Object>} Volume data
   */
  async getVolume(tokenMint, period = '24h') {
    try {
      const periodMap = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const periodMs = periodMap[period] || periodMap['24h'];
      const startTime = new Date(Date.now() - periodMs);

      const trades = await TestnetTrade.find({
        tokenMint,
        status: 'confirmed',
        timestamp: { $gte: startTime }
      })
      .select('solAmount type')
      .lean();

      let totalVolume = 0;
      let buyVolume = 0;
      let sellVolume = 0;
      let buyCount = 0;
      let sellCount = 0;

      trades.forEach(trade => {
        const volume = trade.solAmount || 0;
        totalVolume += volume;

        if (trade.type === 'buy') {
          buyVolume += volume;
          buyCount++;
        } else if (trade.type === 'sell') {
          sellVolume += volume;
          sellCount++;
        }
      });

      return {
        totalVolume,
        buyVolume,
        sellVolume,
        totalTrades: trades.length,
        buyCount,
        sellCount,
        buyRatio: trades.length > 0 ? (buyCount / trades.length) * 100 : 0
      };

    } catch (error) {
      console.error('[Chart Service] Error calculating volume:', error);
      throw error;
    }
  }
}

export default new ChartService();
