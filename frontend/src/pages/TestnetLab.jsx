import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Link } from 'react-router-dom';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  TestTube, Zap, Plus, Rocket, Sparkles,
  TrendingUp, Activity, Search, RefreshCw
} from 'lucide-react';
import { Button, Card, Spinner, Badge } from '../components/common';
import { useNetwork } from '../context/NetworkContext';
import { testnetTokenApi } from '../services/api';
import toast from 'react-hot-toast';

// Legacy imports for fallback when backend unavailable
import { getTokens as getLocalTokens } from '../services/testnet/tokenService';

const TestnetLab = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { isTestnet } = useNetwork();

  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [trendingTokens, setTrendingTokens] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'my', 'trending'

  // Token creation form
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenSupply, setTokenSupply] = useState('1000000000');
  const [tokenDecimals, setTokenDecimals] = useState('9');
  const [tokenDescription, setTokenDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Load tokens on mount and when wallet changes
  useEffect(() => {
    loadTokens();
    loadTrendingTokens();
  }, [wallet.publicKey]);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const params = activeTab === 'my' && wallet.publicKey
        ? { creator: wallet.publicKey.toBase58() }
        : {};

      const res = await testnetTokenApi.getAll({ ...params, limit: 50 });
      setTokens(res.data.tokens || []);
    } catch (error) {
      console.error('Failed to load tokens:', error);
      // Fallback to local tokens if backend unavailable
      const localTokens = getLocalTokens();
      setTokens(localTokens);
    } finally {
      setLoading(false);
    }
  };

  const loadTrendingTokens = async () => {
    try {
      const res = await testnetTokenApi.getTrending(10);
      setTrendingTokens(res.data.tokens || []);
    } catch (error) {
      console.error('Failed to load trending:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadTokens();
      return;
    }

    try {
      setLoading(true);
      const res = await testnetTokenApi.search(searchQuery);
      setTokens(res.data.tokens || []);
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Request SOL airdrop
  const requestAirdrop = async () => {
    if (!wallet.publicKey) {
      toast.error('Connect wallet first');
      return;
    }

    try {
      setLoading(true);
      toast.loading('Requesting 2 SOL from devnet faucet...', { id: 'airdrop' });

      const signature = await connection.requestAirdrop(
        wallet.publicKey,
        2 * LAMPORTS_PER_SOL
      );

      await connection.confirmTransaction(signature, 'confirmed');

      toast.success('Received 2 SOL! Check your wallet.', { id: 'airdrop' });
    } catch (error) {
      console.error('Airdrop error:', error);
      toast.error('Airdrop failed. The faucet might be rate-limited. Try again in a few minutes.', {
        id: 'airdrop',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  // Create new token - uses backend API
  const handleCreateToken = async () => {
    if (!wallet.publicKey) {
      toast.error('Connect wallet first');
      return;
    }

    if (!tokenName || !tokenSymbol) {
      toast.error('Enter token name and symbol');
      return;
    }

    if (!isTestnet) {
      toast.error('Switch to Testnet mode to create test tokens');
      return;
    }

    try {
      setLoading(true);
      toast.loading('Creating token...', { id: 'create-token' });

      // Create via backend API (simulated, no real on-chain tx needed)
      const res = await testnetTokenApi.create({
        name: tokenName,
        symbol: tokenSymbol.toUpperCase(),
        description: tokenDescription,
        totalSupply: parseInt(tokenSupply),
        decimals: parseInt(tokenDecimals),
        creator: wallet.publicKey.toBase58()
      });

      if (res.data.success) {
        toast.success(`Token ${tokenSymbol} created successfully!`, { id: 'create-token' });

        // Reset form
        setTokenName('');
        setTokenSymbol('');
        setTokenSupply('1000000000');
        setTokenDescription('');
        setShowCreateForm(false);

        // Reload tokens
        loadTokens();
      }

    } catch (error) {
      console.error('Token creation error:', error);
      toast.error(error.response?.data?.message || 'Failed to create token', { id: 'create-token' });
    } finally {
      setLoading(false);
    }
  };

  // Handle tab change
  useEffect(() => {
    loadTokens();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <TestTube className="text-warning-400" />
            Testnet Trading Simulator
          </h1>
          <p className="text-dark-400 text-sm">
            Create tokens, test trading strategies, and simulate volume bots risk-free
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={requestAirdrop}
            disabled={loading || !wallet.publicKey}
            variant="outline"
          >
            <Zap size={16} />
            Get 2 SOL
          </Button>
          {wallet.publicKey && isTestnet && (
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus size={16} />
              Create Token
            </Button>
          )}
        </div>
      </div>

      {/* Network Warning */}
      {!isTestnet && (
        <div className="bg-error-900/20 border border-error-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-error-400 text-sm font-medium">
            <TestTube size={16} />
            <span>Please switch to Testnet mode in the header to use this feature</span>
          </div>
        </div>
      )}

      {/* Wallet Not Connected */}
      {!wallet.publicKey && (
        <Card className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="text-primary-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
          <p className="text-dark-400 text-sm">
            Connect your wallet to start creating and trading test tokens
          </p>
        </Card>
      )}

      {/* Search & Tabs */}
      {isTestnet && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Tabs */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={activeTab === 'all' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('all')}
            >
              All Tokens
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'my' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('my')}
              disabled={!wallet.publicKey}
            >
              My Tokens
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'trending' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('trending')}
            >
              <TrendingUp size={14} />
              Trending
            </Button>
          </div>

          {/* Search */}
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search tokens..."
                className="w-full pl-9 pr-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <Button size="sm" variant="ghost" onClick={loadTokens}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
      )}

      {/* Token Creation Modal/Card */}
      {showCreateForm && wallet.publicKey && isTestnet && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Rocket className="text-primary-400" size={20} />
              <h2 className="text-lg font-semibold text-white">Launch Your Token</h2>
            </div>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-dark-500 hover:text-white transition-colors"
            >
              x
            </button>
          </div>

          <div className="space-y-4">
            {/* Name & Symbol */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">
                  Token Name
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="My Awesome Token"
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-800 rounded text-white text-sm focus:outline-none focus:border-primary-600"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">
                  Symbol
                </label>
                <input
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                  placeholder="TOKEN"
                  maxLength={10}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-800 rounded text-white text-sm focus:outline-none focus:border-primary-600 uppercase"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Supply & Decimals */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">
                  Total Supply
                </label>
                <input
                  type="text"
                  value={tokenSupply}
                  onChange={(e) => setTokenSupply(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="1000000000"
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-800 rounded text-white text-sm focus:outline-none focus:border-primary-600"
                  disabled={loading}
                />
                <p className="text-2xs text-dark-500 mt-1">
                  {parseInt(tokenSupply || 0).toLocaleString()} tokens
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">
                  Decimals
                </label>
                <input
                  type="number"
                  value={tokenDecimals}
                  onChange={(e) => setTokenDecimals(e.target.value)}
                  min="0"
                  max="9"
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-800 rounded text-white text-sm focus:outline-none focus:border-primary-600"
                  disabled={loading}
                />
                <p className="text-2xs text-dark-500 mt-1">
                  Precision: {tokenDecimals} decimal places
                </p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">
                Description (Optional)
              </label>
              <textarea
                value={tokenDescription}
                onChange={(e) => setTokenDescription(e.target.value)}
                placeholder="Describe your token..."
                rows={3}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-800 rounded text-white text-sm focus:outline-none focus:border-primary-600 resize-none"
                disabled={loading}
              />
            </div>

            {/* Create Button */}
            <Button
              onClick={handleCreateToken}
              disabled={loading || !tokenName || !tokenSymbol}
              className="w-full"
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  <span>Creating Token...</span>
                </>
              ) : (
                <>
                  <Rocket size={16} />
                  <span>Create Token on Devnet</span>
                </>
              )}
            </Button>

            {/* Info */}
            <div className="text-xs text-dark-500 text-center">
              Token will be created instantly with a bonding curve for trading.
            </div>
          </div>
        </Card>
      )}

      {/* Token List */}
      {isTestnet && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : tokens.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
                <Rocket className="text-dark-600" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No Tokens Yet</h3>
              <p className="text-dark-400 text-sm mb-4">
                {activeTab === 'my'
                  ? "You haven't created any tokens yet."
                  : 'Be the first to create a token!'}
              </p>
              {wallet.publicKey && (
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus size={16} />
                  Create Your First Token
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid gap-3">
              {(activeTab === 'trending' ? trendingTokens : tokens).map((token) => (
                <Link key={token.mint} to={`/testnet/token/${token.mint}`}>
                  <Card className="p-4 hover:border-primary-600 transition-colors cursor-pointer">
                    <div className="flex items-start gap-4">
                      {/* Token Image */}
                      <img
                        src={token.imageUrl || token.image}
                        alt={token.symbol}
                        className="w-12 h-12 rounded-lg flex-shrink-0"
                      />

                      {/* Token Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{token.name}</span>
                          <Badge variant="warning">{token.symbol}</Badge>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-dark-400">
                          <span>
                            Price: <span className="text-white font-mono">
                              {token.bondingCurve?.currentPrice?.toFixed(8) || '0.00000001'}
                            </span> SOL
                          </span>
                          <span>
                            MCap: <span className="text-white">{(token.marketCap || 0).toFixed(2)}</span> SOL
                          </span>
                          <span>
                            Vol: <span className="text-white">{(token.volume24h || 0).toFixed(2)}</span> SOL
                          </span>
                          <span>
                            <span className="text-white">{token.holders || 0}</span> holders
                          </span>
                        </div>

                        {token.description && (
                          <p className="text-xs text-dark-500 mt-1 line-clamp-1">{token.description}</p>
                        )}
                      </div>

                      {/* Price Change */}
                      <div className="text-right">
                        <p className={`text-sm font-medium ${
                          (token.priceChange24h || 0) >= 0 ? 'text-success-400' : 'text-danger-400'
                        }`}>
                          {(token.priceChange24h || 0) >= 0 ? '+' : ''}
                          {(token.priceChange24h || 0).toFixed(2)}%
                        </p>
                        <p className="text-2xs text-dark-500">24h</p>
                      </div>

                      {/* Trade Button */}
                      <Button size="sm" variant="primary">
                        <TrendingUp size={14} />
                        Trade
                      </Button>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Features */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="w-10 h-10 rounded bg-dark-800 flex items-center justify-center mb-3">
            <TestTube className="text-warning-400" size={20} />
          </div>
          <h3 className="font-semibold text-white text-sm mb-1">Bonding Curve Trading</h3>
          <p className="text-xs text-dark-400">
            Pump.fun-style bonding curves with realistic price impact and fees
          </p>
        </Card>

        <Card className="p-4">
          <div className="w-10 h-10 rounded bg-dark-800 flex items-center justify-center mb-3">
            <Zap className="text-primary-400" size={20} />
          </div>
          <h3 className="font-semibold text-white text-sm mb-1">Free SOL</h3>
          <p className="text-xs text-dark-400">
            Get unlimited devnet SOL for testing, no real money needed
          </p>
        </Card>

        <Card className="p-4">
          <div className="w-10 h-10 rounded bg-dark-800 flex items-center justify-center mb-3">
            <Activity className="text-accent-blue" size={20} />
          </div>
          <h3 className="font-semibold text-white text-sm mb-1">Volume Simulator</h3>
          <p className="text-xs text-dark-400">
            Test volume bot strategies with configurable wallets and intervals
          </p>
        </Card>
      </div>
    </div>
  );
};

export default TestnetLab;
