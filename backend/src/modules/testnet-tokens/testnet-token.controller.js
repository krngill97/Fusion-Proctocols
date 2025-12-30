// ===========================================
// Fusion - Testnet Token Controller
// Handles token creation and management
// ===========================================

import TestnetToken from './testnet-token.model.js';
import TestnetHolder from './testnet-holder.model.js';
import { generateId } from '../../shared/utils/helpers.js';
import crypto from 'crypto';

/**
 * Generate simulated mint address
 */
const generateMintAddress = () => {
  const bytes = crypto.randomBytes(32);
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars[bytes[i % 32] % chars.length];
  }
  return result;
};

/**
 * Generate token avatar SVG
 */
const generateTokenAvatar = (symbol) => {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#6366f1', '#f97316'
  ];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const initial = symbol.charAt(0).toUpperCase();

  const svg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="${color}"/>
    <text x="50" y="50" font-family="Arial" font-size="48" fill="white"
          text-anchor="middle" dominant-baseline="central" font-weight="bold">
      ${initial}
    </text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

class TestnetTokenController {

  /**
   * Create a new testnet token
   * POST /api/testnet/tokens
   */
  async createToken(req, res) {
    try {
      const {
        name,
        symbol,
        description = '',
        totalSupply = 1000000000,
        decimals = 9,
        imageUrl,
        metadata = {}
      } = req.body;

      const creator = req.user?.wallet || req.body.creator;

      if (!creator) {
        return res.status(400).json({
          success: false,
          message: 'Creator wallet address is required'
        });
      }

      if (!name || !symbol) {
        return res.status(400).json({
          success: false,
          message: 'Token name and symbol are required'
        });
      }

      // Generate mint address
      const mint = generateMintAddress();

      // Generate avatar if no image provided
      const tokenImage = imageUrl || generateTokenAvatar(symbol);

      // Calculate bonding curve parameters
      const basePrice = 0.000001;
      const maxPrice = 0.01;

      // Create token
      const token = await TestnetToken.create({
        mint,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description.trim(),
        imageUrl: tokenImage,
        creator,
        totalSupply,
        decimals,
        currentSupply: 0,
        bondingCurve: {
          type: 'linear',
          basePrice,
          currentPrice: basePrice,
          maxPrice,
          reserveSOL: 0,
          reserveTokens: totalSupply
        },
        marketCap: 0,
        volume24h: 0,
        volumeTotal: 0,
        priceChange24h: 0,
        holders: 0,
        transactions: 0,
        status: 'active',
        isLaunched: true,
        network: 'devnet',
        metadata
      });

      res.status(201).json({
        success: true,
        token: {
          ...token.toObject(),
          soldPercentage: token.soldPercentage,
          remainingTokens: token.remainingTokens
        }
      });

    } catch (error) {
      console.error('Create token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create token',
        error: error.message
      });
    }
  }

  /**
   * Get token by mint address
   * GET /api/testnet/tokens/:mint
   */
  async getToken(req, res) {
    try {
      const { mint } = req.params;

      const token = await TestnetToken.findOne({ mint }).lean();

      if (!token) {
        return res.status(404).json({
          success: false,
          message: 'Token not found'
        });
      }

      // Add computed fields
      token.soldPercentage = (token.currentSupply / token.totalSupply) * 100;
      token.remainingTokens = token.totalSupply - token.currentSupply;

      res.json({
        success: true,
        token
      });

    } catch (error) {
      console.error('Get token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch token',
        error: error.message
      });
    }
  }

  /**
   * List tokens with pagination and filters
   * GET /api/testnet/tokens
   */
  async listTokens(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        order = 'desc',
        search,
        creator,
        status = 'active'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build query
      let query = {};

      if (status !== 'all') {
        query.status = status;
      }

      if (creator) {
        query.creator = creator;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { symbol: { $regex: search, $options: 'i' } },
          { mint: { $regex: search, $options: 'i' } }
        ];
      }

      // Build sort
      const sortOptions = {};
      sortOptions[sortBy] = order === 'desc' ? -1 : 1;

      const [tokens, total] = await Promise.all([
        TestnetToken.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        TestnetToken.countDocuments(query)
      ]);

      // Add computed fields
      const enrichedTokens = tokens.map(token => ({
        ...token,
        soldPercentage: (token.currentSupply / token.totalSupply) * 100,
        remainingTokens: token.totalSupply - token.currentSupply
      }));

      res.json({
        success: true,
        tokens: enrichedTokens,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
          hasMore: skip + tokens.length < total
        }
      });

    } catch (error) {
      console.error('List tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tokens',
        error: error.message
      });
    }
  }

  /**
   * Get trending tokens
   * GET /api/testnet/tokens/trending
   */
  async getTrendingTokens(req, res) {
    try {
      const { limit = 10 } = req.query;

      const tokens = await TestnetToken.getTrending(parseInt(limit));

      res.json({
        success: true,
        tokens
      });

    } catch (error) {
      console.error('Get trending error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch trending tokens',
        error: error.message
      });
    }
  }

  /**
   * Get new tokens
   * GET /api/testnet/tokens/new
   */
  async getNewTokens(req, res) {
    try {
      const { limit = 10 } = req.query;

      const tokens = await TestnetToken.getNew(parseInt(limit));

      res.json({
        success: true,
        tokens
      });

    } catch (error) {
      console.error('Get new tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch new tokens',
        error: error.message
      });
    }
  }

  /**
   * Get tokens by creator
   * GET /api/testnet/tokens/creator/:wallet
   */
  async getTokensByCreator(req, res) {
    try {
      const { wallet } = req.params;
      const { page = 1, limit = 20, status = 'active' } = req.query;

      const result = await TestnetToken.getByCreator(wallet, {
        page: parseInt(page),
        limit: parseInt(limit),
        status
      });

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Get tokens by creator error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tokens',
        error: error.message
      });
    }
  }

  /**
   * Search tokens
   * GET /api/testnet/tokens/search
   */
  async searchTokens(req, res) {
    try {
      const { q, page = 1, limit = 20 } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters'
        });
      }

      const result = await TestnetToken.search(q, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Search tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search tokens',
        error: error.message
      });
    }
  }

  /**
   * Get user balance for a token
   * GET /api/testnet/tokens/:mint/balance/:wallet
   */
  async getUserBalance(req, res) {
    try {
      const { mint, wallet } = req.params;

      const holder = await TestnetHolder.findOne({ tokenMint: mint, wallet }).lean();

      res.json({
        success: true,
        balance: holder?.balance || 0,
        holder: holder || null
      });

    } catch (error) {
      console.error('Get balance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch balance',
        error: error.message
      });
    }
  }

  /**
   * Get token holders
   * GET /api/testnet/tokens/:mint/holders
   */
  async getTokenHolders(req, res) {
    try {
      const { mint } = req.params;
      const { page = 1, limit = 50, activeOnly = 'true' } = req.query;

      const result = await TestnetHolder.getByToken(mint, {
        page: parseInt(page),
        limit: parseInt(limit),
        activeOnly: activeOnly === 'true'
      });

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Get holders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch holders',
        error: error.message
      });
    }
  }

  /**
   * Get token holder distribution
   * GET /api/testnet/tokens/:mint/distribution
   */
  async getTokenDistribution(req, res) {
    try {
      const { mint } = req.params;

      const distribution = await TestnetHolder.getDistribution(mint);

      res.json({
        success: true,
        ...distribution
      });

    } catch (error) {
      console.error('Get distribution error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch distribution',
        error: error.message
      });
    }
  }

  /**
   * Get token price history
   * GET /api/testnet/tokens/:mint/price-history
   */
  async getPriceHistory(req, res) {
    try {
      const { mint } = req.params;
      const { limit = 100 } = req.query;

      const token = await TestnetToken.findOne({ mint })
        .select('priceHistory bondingCurve.currentPrice')
        .lean();

      if (!token) {
        return res.status(404).json({
          success: false,
          message: 'Token not found'
        });
      }

      const history = token.priceHistory?.slice(-parseInt(limit)) || [];

      res.json({
        success: true,
        currentPrice: token.bondingCurve.currentPrice,
        history
      });

    } catch (error) {
      console.error('Get price history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch price history',
        error: error.message
      });
    }
  }

  /**
   * Get token stats
   * GET /api/testnet/tokens/:mint/stats
   */
  async getTokenStats(req, res) {
    try {
      const { mint } = req.params;

      const token = await TestnetToken.findOne({ mint }).lean();

      if (!token) {
        return res.status(404).json({
          success: false,
          message: 'Token not found'
        });
      }

      const holderCount = await TestnetHolder.getActiveCount(mint);

      res.json({
        success: true,
        stats: {
          marketCap: token.marketCap,
          volume24h: token.volume24h,
          volumeTotal: token.volumeTotal,
          priceChange24h: token.priceChange24h,
          holders: holderCount,
          transactions: token.transactions,
          currentPrice: token.bondingCurve.currentPrice,
          soldPercentage: (token.currentSupply / token.totalSupply) * 100
        }
      });

    } catch (error) {
      console.error('Get token stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stats',
        error: error.message
      });
    }
  }

  /**
   * Get tradable tokens (tokens with liquidity added)
   * GET /api/testnet/tokens/tradable
   */
  async getTradableTokens(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'volume24h',
        network = 'devnet'
      } = req.query;

      const skip = (page - 1) * limit;

      // Query for tokens with liquidity
      const query = {
        status: {
          $in: ['LIQUIDITY_ADDED', 'TRADABLE', 'VOLUME_BOT_ACTIVE']
        },
        network
      };

      // Determine sort order
      const sortOptions = {};
      switch (sortBy) {
        case 'liquidity':
          sortOptions['lifecycle.currentLiquiditySOL'] = -1;
          break;
        case 'volume':
          sortOptions.volume24h = -1;
          break;
        case 'created':
          sortOptions.createdAt = -1;
          break;
        case 'price':
          sortOptions['bondingCurve.currentPrice'] = -1;
          break;
        default:
          sortOptions.volume24h = -1;
      }

      // Fetch tokens
      const [tokens, total] = await Promise.all([
        TestnetToken.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        TestnetToken.countDocuments(query)
      ]);

      // Enrich tokens with additional data
      const enrichedTokens = await Promise.all(
        tokens.map(async (token) => {
          const holderCount = await TestnetHolder.getActiveCount(token.mint);

          // Calculate current price from reserves if pool exists
          let currentPrice = token.bondingCurve?.currentPrice || 0;
          if (token.lifecycle?.currentLiquiditySOL && token.lifecycle?.currentLiquidityTokens) {
            currentPrice = token.lifecycle.currentLiquiditySOL / token.lifecycle.currentLiquidityTokens;
          }

          return {
            mint: token.mint,
            name: token.name,
            symbol: token.symbol,
            description: token.description,
            imageUrl: token.imageUrl,
            status: token.status,

            // Lifecycle data
            lifecycle: {
              poolAddress: token.lifecycle?.poolAddress || null,
              poolId: token.lifecycle?.poolId || null,
              liquidityAddedAt: token.lifecycle?.liquidityAddedAt || null,
              tradingStartedAt: token.lifecycle?.tradingStartedAt || null,
              volumeBotStartedAt: token.lifecycle?.volumeBotStartedAt || null
            },

            // Price data
            price: currentPrice,
            priceChange24h: token.priceChange24h || 0,

            // Liquidity data
            liquidity: {
              sol: token.lifecycle?.currentLiquiditySOL || 0,
              tokens: token.lifecycle?.currentLiquidityTokens || 0,
              usd: (token.lifecycle?.currentLiquiditySOL || 0) * 100 // Simplified USD calc
            },

            // Volume data
            volume24h: token.volume24h || 0,
            volumeTotal: token.volumeTotal || 0,

            // Trading stats
            tradingStats: token.lifecycle?.tradingStats || {
              totalTrades: 0,
              totalVolume: 0,
              buyCount: 0,
              sellCount: 0
            },

            // Additional stats
            holders: holderCount,
            transactions: token.transactions || 0,
            marketCap: token.marketCap || 0,

            // Links
            solscanUrl: `https://solscan.io/token/${token.mint}?cluster=${network}`,

            // Metadata
            creator: token.creator,
            createdAt: token.createdAt,
            network: token.network
          };
        })
      );

      res.json({
        success: true,
        tokens: enrichedTokens,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get tradable tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tradable tokens',
        error: error.message
      });
    }
  }
}

export default new TestnetTokenController();
