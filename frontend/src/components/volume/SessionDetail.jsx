import { useState, useEffect } from 'react';
import { 
  X, 
  Bot,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Clock,
  Wallet,
  Zap,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { volumeApi } from '../../services/api';
import { Badge } from '../common';
import toast from 'react-hot-toast';

const SessionDetail = ({ session, onClose, onRefresh }) => {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  useEffect(() => {
    fetchDetails();
  }, [session._id, pagination.page]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const [txRes, statsRes] = await Promise.all([
        volumeApi.getTransactions(session._id, { 
          page: pagination.page, 
          limit: pagination.limit 
        }),
        volumeApi.getSessionStats(session._id)
      ]);

      setTransactions(txRes.data.data.transactions || txRes.data.data);
      setStats(statsRes.data.data);
      setPagination(prev => ({
        ...prev,
        total: txRes.data.data.total || txRes.data.data.length
      }));
    } catch (error) {
      toast.error('Failed to load session details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied');
  };

  const shortenAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms) => {
    if (!ms) return '--';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'warning',
      running: 'success',
      paused: 'info',
      completed: 'primary',
      failed: 'error'
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  // Calculate progress
  const volumeProgress = stats?.totalVolume && session.config?.targetVolume
    ? (stats.totalVolume / session.config.targetVolume) * 100
    : 0;

  const elapsed = session.startedAt 
    ? Date.now() - new Date(session.startedAt).getTime()
    : 0;
  const timeProgress = session.config?.maxDuration 
    ? (elapsed / session.config.maxDuration) * 100
    : 0;

  return (
    <>
      {/* Overlay */}
      <div className="modal-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="modal-content max-w-3xl">
        {/* Header */}
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Bot className="text-accent-purple" size={24} />
                <h2 className="text-xl font-semibold text-white">Session Details</h2>
                {getStatusBadge(session.status)}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-dark-400">
                  {shortenAddress(session.tokenMint)}
                </span>
                <button 
                  onClick={() => handleCopy(session.tokenMint)}
                  className="text-dark-500 hover:text-white"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <a
                  href={`https://solscan.io/token/${session.tokenMint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dark-500 hover:text-primary-400"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={fetchDetails}
                className="p-2 text-dark-400 hover:text-white"
              >
                <RefreshCw size={16} />
              </button>
              <button onClick={onClose} className="p-2 text-dark-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Progress Bars */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-dark-400">Volume Progress</span>
                <span className="text-white">{volumeProgress.toFixed(1)}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-bar-fill bg-accent-purple" 
                  style={{ width: `${Math.min(volumeProgress, 100)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-dark-400">Time Progress</span>
                <span className="text-white">{Math.min(timeProgress, 100).toFixed(1)}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-bar-fill bg-primary-500" 
                  style={{ width: `${Math.min(timeProgress, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatBox 
              icon={TrendingUp}
              label="Total Volume"
              value={`${stats?.totalVolume?.toFixed(4) || '0'} SOL`}
              color="purple"
            />
            <StatBox 
              icon={Zap}
              label="Total Trades"
              value={stats?.totalTrades || 0}
              color="primary"
            />
            <StatBox 
              icon={Wallet}
              label="Deposit"
              value={`${session.depositAmount?.toFixed(2) || '0'} SOL`}
            />
            <StatBox 
              icon={Clock}
              label="Elapsed"
              value={formatDuration(elapsed)}
            />
          </div>

          {/* Buy/Sell Breakdown */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-success/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="text-success" size={16} />
                <span className="text-success font-medium">Buys</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats?.buyCount || 0}</p>
              <p className="text-sm text-dark-400">
                {stats?.buyVolume?.toFixed(4) || '0'} SOL
              </p>
            </div>
            <div className="bg-error/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="text-error" size={16} />
                <span className="text-error font-medium">Sells</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats?.sellCount || 0}</p>
              <p className="text-sm text-dark-400">
                {stats?.sellVolume?.toFixed(4) || '0'} SOL
              </p>
            </div>
          </div>

          {/* Maker Wallets */}
          <div className="mb-6">
            <h3 className="font-semibold text-white mb-3">Maker Wallets ({session.makerWallets?.length || 0})</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {session.makerWallets?.map((wallet, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-dark-800 rounded-lg text-sm">
                  <span className="font-mono text-dark-300">{shortenAddress(wallet.publicKey)}</span>
                  <span className="text-dark-400">{wallet.tradesCompleted || 0} trades</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transactions */}
          <div>
            <h3 className="font-semibold text-white mb-3">Recent Transactions</h3>
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="spinner"></div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-4 text-dark-400">
                No transactions yet
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {transactions.map((tx, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        {tx.type === 'buy' ? (
                          <TrendingUp className="text-success" size={16} />
                        ) : (
                          <TrendingDown className="text-error" size={16} />
                        )}
                        <div>
                          <p className="text-sm text-white">
                            {tx.type.toUpperCase()} {tx.amount?.toFixed(6)} SOL
                          </p>
                          <p className="text-xs text-dark-400">
                            {formatTime(tx.timestamp)}
                          </p>
                        </div>
                      </div>
                      {tx.txSignature && (
                        <a
                          href={`https://solscan.io/tx/${tx.txSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-dark-400">
                      Page {pagination.page} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page === 1}
                        className="btn btn-secondary btn-sm"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={pagination.page >= totalPages}
                        className="btn btn-secondary btn-sm"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// Stat Box Component
const StatBox = ({ icon: Icon, label, value, color = 'default' }) => {
  const colorClasses = {
    default: 'bg-dark-800',
    primary: 'bg-primary-600/20',
    purple: 'bg-accent-purple/20',
    success: 'bg-success/20',
  };

  return (
    <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 text-dark-400 text-xs mb-1">
        <Icon size={12} />
        {label}
      </div>
      <p className="text-white font-semibold">{value}</p>
    </div>
  );
};

export default SessionDetail;
