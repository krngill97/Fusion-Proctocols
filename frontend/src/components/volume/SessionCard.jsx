import { 
  Play, 
  Pause, 
  Square, 
  Eye,
  Clock,
  TrendingUp,
  Wallet,
  Zap,
  ExternalLink
} from 'lucide-react';
import { Badge } from '../common';

const SessionCard = ({ session, onStart, onPause, onResume, onStop, onViewDetails }) => {
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

  const formatDuration = (ms) => {
    if (!ms) return '--';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleString();
  };

  const shortenAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const progress = session.stats?.totalVolume && session.config?.targetVolume
    ? (session.stats.totalVolume / session.config.targetVolume) * 100
    : 0;

  return (
    <div className="card hover:border-dark-600 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-dark-300">
              {shortenAddress(session.tokenMint)}
            </span>
            <a
              href={`https://solscan.io/token/${session.tokenMint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dark-500 hover:text-primary-400"
            >
              <ExternalLink size={12} />
            </a>
          </div>
          <p className="text-xs text-dark-500">
            Created {formatTime(session.createdAt)}
          </p>
        </div>
        {getStatusBadge(session.status)}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-dark-400">Progress</span>
          <span className="text-white">{progress.toFixed(1)}%</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-dark-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-dark-400 text-xs mb-1">
            <TrendingUp size={12} />
            Volume
          </div>
          <p className="text-white font-medium">
            {session.stats?.totalVolume?.toFixed(4) || '0'} SOL
          </p>
        </div>
        <div className="bg-dark-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-dark-400 text-xs mb-1">
            <Zap size={12} />
            Trades
          </div>
          <p className="text-white font-medium">
            {session.stats?.totalTrades || 0}
          </p>
        </div>
        <div className="bg-dark-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-dark-400 text-xs mb-1">
            <Wallet size={12} />
            Deposit
          </div>
          <p className="text-white font-medium">
            {session.depositAmount?.toFixed(2) || '0'} SOL
          </p>
        </div>
        <div className="bg-dark-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-dark-400 text-xs mb-1">
            <Clock size={12} />
            Duration
          </div>
          <p className="text-white font-medium">
            {formatDuration(session.config?.maxDuration)}
          </p>
        </div>
      </div>

      {/* Buy/Sell Stats */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-success">▲</span>
          <span className="text-dark-400">Buys:</span>
          <span className="text-white">{session.stats?.buyCount || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-error">▼</span>
          <span className="text-dark-400">Sells:</span>
          <span className="text-white">{session.stats?.sellCount || 0}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {session.status === 'pending' && (
          <button onClick={onStart} className="btn btn-success btn-sm flex-1 flex items-center justify-center gap-2">
            <Play size={14} />
            Start
          </button>
        )}
        {session.status === 'running' && (
          <>
            <button onClick={onPause} className="btn btn-warning btn-sm flex-1 flex items-center justify-center gap-2">
              <Pause size={14} />
              Pause
            </button>
            <button onClick={onStop} className="btn btn-danger btn-sm flex-1 flex items-center justify-center gap-2">
              <Square size={14} />
              Stop
            </button>
          </>
        )}
        {session.status === 'paused' && (
          <>
            <button onClick={onResume} className="btn btn-success btn-sm flex-1 flex items-center justify-center gap-2">
              <Play size={14} />
              Resume
            </button>
            <button onClick={onStop} className="btn btn-danger btn-sm flex-1 flex items-center justify-center gap-2">
              <Square size={14} />
              Stop
            </button>
          </>
        )}
        <button onClick={onViewDetails} className="btn btn-secondary btn-sm flex items-center justify-center gap-2">
          <Eye size={14} />
          Details
        </button>
      </div>
    </div>
  );
};

export default SessionCard;
