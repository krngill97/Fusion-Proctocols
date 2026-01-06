import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ArrowLeft, Copy, ExternalLink, TrendingUp, Activity,
  Users, DollarSign, RefreshCw, BarChart3
} from 'lucide-react';
import { Button, Card, Spinner, Badge } from '../components/common';
import TestnetTradingPanel from '../components/testnet/TestnetTradingPanel';
import TestnetRecentTrades from '../components/testnet/TestnetRecentTrades';
import TestnetBondingCurve from '../components/testnet/TestnetBondingCurve';
import VolumeSimulator from '../components/testnet/VolumeSimulator';
import PriceChart from '../components/charts/PriceChart';
import { testnetTokenApi } from '../services/api';
import toast from 'react-hot-toast';

const TestnetTokenPage = () => {
  const { mint } = useParams();
  const { publicKey } = useWallet();

  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trade');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (mint) {
      fetchToken();
    }
  }, [mint]);

  const fetchToken = async () => {
    try {
      setLoading(true);
      const res = await testnetTokenApi.getById(mint);
      setToken(res.data.token);
    } catch (error) {
      console.error('Failed to fetch token:', error);
      toast.error('Token not found');
    } finally {
      setLoading(false);
    }
  };

  const handleTradeComplete = (trade, updatedToken) => {
    setToken(prev => ({
      ...prev,
      ...updatedToken,
      bondingCurve: updatedToken.bondingCurve || prev.bondingCurve
    }));
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSessionUpdate = () => {
    fetchToken();
    setRefreshTrigger(prev => prev + 1);
  };

  const copyToClipboard = (text, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-white mb-2">Token Not Found</h2>
        <p className="text-dark-400 mb-4">This token doesn't exist or has been removed.</p>
        <Link to="/testnet">
          <Button>
            <ArrowLeft size={16} />
            Back to Testnet Lab
          </Button>
        </Link>
      </div>
    );
  }

  const priceChange = token.priceChange24h || 0;
  const isPositiveChange = priceChange >= 0;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/testnet" className="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors">
        <ArrowLeft size={18} />
        <span>Back to Testnet Lab</span>
      </Link>

      {/* Token Header */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          {/* Token Image */}
          <img
            src={token.imageUrl}
            alt={token.symbol}
            className="w-20 h-20 rounded-xl flex-shrink-0"
          />

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">{token.name}</h1>
              <Badge variant="warning" size="lg">{token.symbol}</Badge>
              <Badge variant="primary">Testnet</Badge>
            </div>

            {token.description && (
              <p className="text-sm text-dark-400 mb-3 max-w-2xl">{token.description}</p>
            )}

            {/* Mint Address */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-dark-500">Mint:</span>
              <code className="text-dark-300 font-mono">
                {mint.slice(0, 12)}...{mint.slice(-8)}
              </code>
              <button
                onClick={() => copyToClipboard(mint, 'Mint address')}
                className="text-dark-500 hover:text-primary-400 transition-colors"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Link to={`/chart/${mint}`}>
              <Button variant="primary">
                <BarChart3 size={16} />
                View Chart
              </Button>
            </Link>
            <Button variant="ghost" onClick={fetchToken}>
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-dark-800">
          <div>
            <p className="text-xs text-dark-500 mb-1">Price</p>
            <p className="text-lg font-bold text-white font-mono">
              {token.bondingCurve?.currentPrice?.toFixed(8) || '0.00000001'} SOL
            </p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">24h Change</p>
            <p className={`text-lg font-bold ${isPositiveChange ? 'text-success-400' : 'text-danger-400'}`}>
              {isPositiveChange ? '+' : ''}{priceChange.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Market Cap</p>
            <p className="text-lg font-bold text-white">
              {token.marketCap?.toFixed(4) || '0.0000'} SOL
            </p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Volume 24h</p>
            <p className="text-lg font-bold text-white">
              {token.volume24h?.toFixed(4) || '0.0000'} SOL
            </p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Holders</p>
            <p className="text-lg font-bold text-white">{token.holders || 0}</p>
          </div>
        </div>
      </Card>

      {/* Price Chart */}
      <PriceChart tokenMint={mint} height={500} />

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'trade' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('trade')}
        >
          <TrendingUp size={16} />
          Trade
        </Button>
        <Button
          variant={activeTab === 'volume' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('volume')}
        >
          <Activity size={16} />
          Volume Bot
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Trading/Volume Panel */}
        <div className="lg:col-span-1 space-y-6">
          {activeTab === 'trade' ? (
            <TestnetTradingPanel
              token={token}
              onTradeComplete={handleTradeComplete}
            />
          ) : (
            <VolumeSimulator
              tokenMint={token.mint}
              tokenSymbol={token.symbol}
              onSessionUpdate={handleSessionUpdate}
            />
          )}

          {/* Bonding Curve */}
          <TestnetBondingCurve token={token} />
        </div>

        {/* Right Column - Recent Trades */}
        <div className="lg:col-span-2">
          <TestnetRecentTrades
            tokenMint={token.mint}
            tokenSymbol={token.symbol}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>
    </div>
  );
};

export default TestnetTokenPage;
