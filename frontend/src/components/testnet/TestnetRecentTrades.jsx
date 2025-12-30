import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { Card, Button, Spinner } from '../common';
import { testnetTradeApi } from '../../services/api';

const TestnetRecentTrades = ({ tokenMint, tokenSymbol, refreshTrigger }) => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrades();
  }, [tokenMint, refreshTrigger]);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const res = await testnetTradeApi.getRecent(tokenMint, 30);
      setTrades(res.data.trades || []);
    } catch (error) {
      console.error('Failed to fetch trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Recent Trades</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchTrades}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {loading && trades.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-8 text-dark-500 text-sm">
          No trades yet. Be the first to trade!
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {trades.map((trade) => (
            <div
              key={trade.signature}
              className="flex items-center justify-between p-3 bg-dark-900 rounded-lg hover:bg-dark-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                {trade.type === 'buy' ? (
                  <div className="w-8 h-8 rounded bg-success-900/30 flex items-center justify-center">
                    <ArrowUpRight size={16} className="text-success-400" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded bg-danger-900/30 flex items-center justify-center">
                    <ArrowDownRight size={16} className="text-danger-400" />
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${trade.type === 'buy' ? 'text-success-400' : 'text-danger-400'}`}>
                      {trade.type === 'buy' ? 'Buy' : 'Sell'}
                    </span>
                    {trade.isVolumeBot && (
                      <span className="px-1.5 py-0.5 text-2xs bg-primary-900/30 text-primary-400 rounded">
                        Bot
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-dark-500">
                    {formatAddress(trade.wallet)} • {formatTime(trade.timestamp)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-medium text-white">
                  {trade.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tokenSymbol}
                </p>
                <p className="text-xs text-dark-400">
                  {trade.solAmount.toFixed(4)} SOL
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default TestnetRecentTrades;
