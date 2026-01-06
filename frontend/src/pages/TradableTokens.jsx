import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ExternalLink } from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import api from '../services/api';
import { Card, Button, Spinner, EmptyState, Badge } from '../components/common';

export default function TradableTokens() {
  const navigate = useNavigate();
  const { currentNetwork } = useNetwork();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('volume');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    fetchTradableTokens();
  }, [currentNetwork, sortBy, pagination.page]);

  const fetchTradableTokens = async () => {
    try {
      setLoading(true);
      const response = await api.get('/testnet/tokens/tradable', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          sortBy,
          network: currentNetwork
        }
      });

      if (response.data.success) {
        setTokens(response.data.tokens);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination
        }));
      }
    } catch (error) {
      console.error('Error fetching tradable tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'TRADABLE':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'VOLUME_BOT_ACTIVE':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'LIQUIDITY_ADDED':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  if (loading && tokens.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Tradable Tokens</h1>
          <p className="text-slate-400 mt-1">
            Tokens with liquidity pools ready for trading
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="volume">Volume (24h)</option>
            <option value="liquidity">Liquidity</option>
            <option value="price">Price</option>
            <option value="created">Recently Added</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="text-sm text-slate-400">Total Tradable</div>
          <div className="text-2xl font-bold text-white mt-1">
            {pagination.total}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Network</div>
          <div className="text-2xl font-bold text-white mt-1 capitalize">
            {currentNetwork}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Sort</div>
          <div className="text-2xl font-bold text-white mt-1 capitalize">
            {sortBy}
          </div>
        </Card>
      </div>

      {/* Tokens Grid */}
      {tokens.length === 0 ? (
        <EmptyState
          title="No Tradable Tokens"
          message="Create a token and add liquidity to see it here"
          actionLabel="Create Token"
          onAction={() => navigate('/real-token-launch')}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((token) => (
              <TokenCard
                key={token.mint}
                token={token}
                onClick={() => navigate(`/testnet/token/${token.mint}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-400">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.pages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Token Card Component
function TokenCard({ token, onClick }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'TRADABLE':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'VOLUME_BOT_ACTIVE':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'LIQUIDITY_ADDED':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const priceChangeColor = token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <Card
      className="hover:border-blue-500/50 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Token Icon */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              {token.symbol?.charAt(0) || '?'}
            </div>

            {/* Token Info */}
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                {token.name}
              </h3>
              <p className="text-sm text-slate-400">{token.symbol}</p>
            </div>
          </div>

          {/* Status Badge */}
          <Badge className={getStatusColor(token.status)}>
            {token.status.replace('_', ' ')}
          </Badge>
        </div>

        {/* Price */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {token.price.toFixed(6)} SOL
            </span>
            {token.priceChange24h !== 0 && (
              <span className={`text-sm font-medium ${priceChangeColor}`}>
                {token.priceChange24h >= 0 ? '+' : ''}
                {token.priceChange24h.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700">
          <div>
            <div className="text-xs text-slate-400">Liquidity</div>
            <div className="text-sm font-semibold text-white">
              {formatNumber(token.liquidity.sol)} SOL
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Volume 24h</div>
            <div className="text-sm font-semibold text-white">
              {formatNumber(token.volume24h)} SOL
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Holders</div>
            <div className="text-sm font-semibold text-white">
              {token.holders}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Trades</div>
            <div className="text-sm font-semibold text-white">
              {token.tradingStats.totalTrades}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/chart/${token.mint}`);
            }}
          >
            <BarChart3 size={14} />
            View Chart
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              window.open(token.solscanUrl, '_blank');
            }}
          >
            <ExternalLink size={14} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
