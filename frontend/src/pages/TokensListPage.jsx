import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { testnetTokenApi } from '../services/api';

export default function TokensListPage() {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTokens();
    const interval = setInterval(loadTokens, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadTokens = async () => {
    try {
      const res = await testnetTokenApi.getAll({ limit: 100, sort: '-createdAt' });
      if (res.data?.success) {
        setTokens(res.data.data?.tokens || []);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading tokens:', error);
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num < 0.000001) return num.toFixed(10);
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toFixed(2);
    if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
    return (num / 1000000).toFixed(2) + 'M';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading tokens...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Devnet Token Explorer</h1>
          <p className="text-gray-400 mt-2">All tokens created on Solana devnet</p>
        </div>
      </div>

      {/* Tokens Table */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {tokens.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No tokens found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr className="text-left text-sm text-gray-400">
                  <th className="p-4">#</th>
                  <th className="p-4">Token</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">24h Change</th>
                  <th className="p-4">Volume 24h</th>
                  <th className="p-4">Liquidity</th>
                  <th className="p-4">Trades</th>
                  <th className="p-4">Created</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {tokens.map((token, index) => (
                  <tr
                    key={token.mint}
                    className="hover:bg-gray-700/50 transition cursor-pointer"
                    onClick={() => navigate(`/token/${token.mint}`)}
                  >
                    <td className="p-4 text-gray-400">{index + 1}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-lg font-bold">
                          {token.symbol?.[0] || 'T'}
                        </div>
                        <div>
                          <div className="font-semibold">{token.name}</div>
                          <div className="text-xs text-gray-400">{token.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono">
                      ${(token.price * 100).toFixed(8) || '0.00000000'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-sm font-semibold ${
                        (token.priceChange24h || 0) >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}>
                        {(token.priceChange24h || 0) >= 0 ? '+' : ''}{(token.priceChange24h || 0).toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-4 font-mono">
                      {formatNumber(token.volume24h || 0)} SOL
                    </td>
                    <td className="p-4 font-mono">
                      {formatNumber(token.liquidity || 0)} SOL
                    </td>
                    <td className="p-4">
                      {token.trades24h || 0}
                    </td>
                    <td className="p-4 text-gray-400">
                      {formatTime(token.createdAt)}
                    </td>
                    <td className="p-4">
                      <a
                        href={`https://solscan.io/token/${token.mint}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Solscan →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
