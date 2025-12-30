import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ExternalLink, 
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { tradingApi } from '../../services/api';
import { Badge } from '../common';
import toast from 'react-hot-toast';

const TradeHistory = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', status: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  useEffect(() => {
    fetchTrades();
  }, [filter, pagination.page]);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filter
      };
      
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const response = await tradingApi.getHistory(params);
      setTrades(response.data.data.trades || response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.data.total || response.data.data.length
      }));
    } catch (error) {
      toast.error('Failed to load trade history');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const shortenAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filter.type}
          onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
          className="input w-32"
        >
          <option value="">All Types</option>
          <option value="buy">Buys</option>
          <option value="sell">Sells</option>
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
          className="input w-36"
        >
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Trade List */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto"></div>
          </div>
        ) : trades.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="mx-auto text-dark-500 mb-2" size={32} />
            <p className="text-dark-400">No trades found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Token</th>
                  <th>Amount</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>TX</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade._id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {trade.type === 'buy' ? (
                          <TrendingUp className="text-success" size={16} />
                        ) : (
                          <TrendingDown className="text-error" size={16} />
                        )}
                        <span className={trade.type === 'buy' ? 'text-success' : 'text-error'}>
                          {trade.type.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="text-white font-medium">{trade.tokenSymbol || 'Unknown'}</p>
                        <p className="text-xs text-dark-400 font-mono">
                          {shortenAddress(trade.tokenMint)}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="text-white">
                          {trade.type === 'buy' 
                            ? `${trade.solAmount?.toFixed(4)} SOL`
                            : `${trade.tokenAmount?.toLocaleString()} tokens`
                          }
                        </p>
                        {trade.outputAmount && (
                          <p className="text-xs text-dark-400">
                            → {trade.outputAmount.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-white">
                        {trade.pricePerToken?.toFixed(8) || '--'}
                      </span>
                    </td>
                    <td>
                      <Badge variant={
                        trade.status === 'completed' ? 'success' :
                        trade.status === 'pending' ? 'warning' :
                        trade.status === 'failed' ? 'error' : 'default'
                      }>
                        {trade.status}
                      </Badge>
                    </td>
                    <td>
                      <span className="text-sm text-dark-400">
                        {formatTime(trade.createdAt)}
                      </span>
                    </td>
                    <td>
                      {trade.txSignature ? (
                        <a
                          href={`https://solscan.io/tx/${trade.txSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300"
                        >
                          <ExternalLink size={16} />
                        </a>
                      ) : (
                        <span className="text-dark-500">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">
            Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-white">
              Page {pagination.page} of {totalPages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= totalPages}
              className="btn btn-secondary btn-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeHistory;
