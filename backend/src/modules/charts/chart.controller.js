/**
 * Chart Controller
 * Handles API requests for chart data
 */

import Joi from 'joi';
import chartService from './chart.service.js';

// Validation schema for OHLCV request
const ohlcvSchema = Joi.object({
  timeframe: Joi.string()
    .valid('1m', '5m', '15m', '1h', '4h', '1d')
    .default('5m')
    .messages({
      'any.only': 'Timeframe must be one of: 1m, 5m, 15m, 1h, 4h, 1d'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 1000'
    })
});

// Validation schema for price change request
const priceChangeSchema = Joi.object({
  period: Joi.string()
    .valid('1h', '24h', '7d', '30d')
    .default('24h')
    .messages({
      'any.only': 'Period must be one of: 1h, 24h, 7d, 30d'
    })
});

class ChartController {
  /**
   * Get OHLCV candles for a token
   * GET /api/charts/ohlcv/:tokenMint
   */
  async getOHLCV(req, res) {
    try {
      const { tokenMint } = req.params;

      if (!tokenMint) {
        return res.status(400).json({
          success: false,
          message: 'Token mint address is required'
        });
      }

      // Validate query parameters
      const { error, value } = ohlcvSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => d.message)
        });
      }

      const { timeframe, limit } = value;

      const candles = await chartService.getOHLCV(tokenMint, timeframe, limit);

      res.json({
        success: true,
        tokenMint,
        timeframe,
        candles,
        count: candles.length
      });

    } catch (error) {
      console.error('[Chart Controller] Get OHLCV error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch OHLCV data',
        error: error.message
      });
    }
  }

  /**
   * Get latest price for a token
   * GET /api/charts/price/:tokenMint
   */
  async getLatestPrice(req, res) {
    try {
      const { tokenMint } = req.params;

      if (!tokenMint) {
        return res.status(400).json({
          success: false,
          message: 'Token mint address is required'
        });
      }

      const priceData = await chartService.getLatestPrice(tokenMint);

      if (!priceData) {
        return res.status(404).json({
          success: false,
          message: 'No price data found for this token'
        });
      }

      res.json({
        success: true,
        tokenMint,
        ...priceData
      });

    } catch (error) {
      console.error('[Chart Controller] Get latest price error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch latest price',
        error: error.message
      });
    }
  }

  /**
   * Get price change for a token
   * GET /api/charts/price-change/:tokenMint
   */
  async getPriceChange(req, res) {
    try {
      const { tokenMint } = req.params;

      if (!tokenMint) {
        return res.status(400).json({
          success: false,
          message: 'Token mint address is required'
        });
      }

      // Validate query parameters
      const { error, value } = priceChangeSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => d.message)
        });
      }

      const { period } = value;

      const priceChange = await chartService.getPriceChange(tokenMint, period);

      res.json({
        success: true,
        tokenMint,
        period,
        ...priceChange
      });

    } catch (error) {
      console.error('[Chart Controller] Get price change error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch price change',
        error: error.message
      });
    }
  }

  /**
   * Get volume data for a token
   * GET /api/charts/volume/:tokenMint
   */
  async getVolume(req, res) {
    try {
      const { tokenMint } = req.params;

      if (!tokenMint) {
        return res.status(400).json({
          success: false,
          message: 'Token mint address is required'
        });
      }

      // Validate query parameters
      const { error, value } = priceChangeSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => d.message)
        });
      }

      const { period } = value;

      const volumeData = await chartService.getVolume(tokenMint, period);

      res.json({
        success: true,
        tokenMint,
        period,
        ...volumeData
      });

    } catch (error) {
      console.error('[Chart Controller] Get volume error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch volume data',
        error: error.message
      });
    }
  }

  /**
   * Get complete chart data (OHLCV + latest price + volume)
   * GET /api/charts/complete/:tokenMint
   */
  async getCompleteChartData(req, res) {
    try {
      const { tokenMint } = req.params;

      if (!tokenMint) {
        return res.status(400).json({
          success: false,
          message: 'Token mint address is required'
        });
      }

      // Validate query parameters
      const { error, value } = ohlcvSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => d.message)
        });
      }

      const { timeframe, limit } = value;

      // Fetch all data in parallel
      const [candles, latestPrice, priceChange, volume] = await Promise.all([
        chartService.getOHLCV(tokenMint, timeframe, limit),
        chartService.getLatestPrice(tokenMint),
        chartService.getPriceChange(tokenMint, '24h'),
        chartService.getVolume(tokenMint, '24h')
      ]);

      res.json({
        success: true,
        tokenMint,
        timeframe,
        candles,
        latestPrice,
        priceChange24h: priceChange,
        volume24h: volume
      });

    } catch (error) {
      console.error('[Chart Controller] Get complete chart data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch complete chart data',
        error: error.message
      });
    }
  }
}

export default new ChartController();
