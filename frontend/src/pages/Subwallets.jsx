import { useState, useEffect } from 'react';
import { 
  Search, 
  Play, 
  Square, 
  RefreshCw,
  ExternalLink,
  Eye,
  Clock,
  Zap,
  Droplets,
  ShoppingCart,
  Filter,
  ChevronDown,
  ArrowUpRight,
  Timer
} from 'lucide-react';
import { subwalletApi } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import toast from 'react-hot-toast';
import SubwalletDetail from '../components/subwallets/SubwalletDetail';
import MintFeed from '../components/subwallets/MintFeed';
import { Badge } from '../components/common';

const Subwallets = () => {
  const { on, subscribe } = useWebSocket();
  
  const [subwallets, setSubwallets] = useState([]);
  const [recentMints, setRecentMints] = useState([]);
  const [stats, setStats] = useState(null);
  const [analyzerStatus, setAnalyzerStatus] = useState({ isRunning: false });
  const [loading, setLoading] = useState(true);
  const [selectedSubwallet, setSelectedSubwallet] = useState(null);
  const [filter, setFilter] = useState({ status: '', activity: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data on mount
  useEffect(() => {
    fetchData();
    subscribe('subwallets');
  }, []);

  // Subscribe to real-time events
  useEffect(() => {
    const unsubMint = on('subwallet:mint', (data) => {
      setRecentMints(prev => [data, ...prev.slice(0, 19)]);
      toast.success(`New mint: ${data.tokenSymbol || 'Unknown'}`, { icon: '🎉' });
    });

    const unsubPool = on('subwallet:pool', (data) => {
      toast.success(`Pool created: ${data.platform}`, { icon: '💧' });
    });

    const unsubNew = on('subwallet:new', (data) => {
      setSubwallets(prev => [data, ...prev]);
      toast.success('New subwallet detected', { icon: '👀' });
    });

    return () => {
      unsubMint();
      unsubPool();
      unsubNew();
    };
  }, [on]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subwalletsRes, statsRes, statusRes, mintsRes] = await Promise.all([
        subwalletApi.getAll({ limit: 100 }),
        subwalletApi.getStats(),
        subwalletApi.getAnalyzerStatus(),
        subwalletApi.getRecentMints(20)
      ]);

      setSubwallets(subwalletsRes.data.data.subwallets || subwalletsRes.data.data);
      setStats(statsRes.data.data);
      setAnalyzerStatus(statusRes.data.data);
      setRecentMints(mintsRes.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch subwallets');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAnalyzer = async () => {
    try {
      await subwalletApi.startAnalyzer();
      setAnalyzerStatus({ isRunning: true });
      toast.success('Analyzer started');
    } catch (error) {
      toast.error('Failed to start analyzer');
    }
  };

  const handleStopAnalyzer = async () => {
    try {
      await subwalletApi.stopAnalyzer();
      setAnalyzerStatus({ isRunning: false });
      toast.success('Analyzer stopped');
    } catch (error) {
      toast.error('Failed to stop analyzer');
    }
  };

  const handleExtendWatch = async (subwallet, hours = 24) => {
    try {
      await subwalletApi.extendWatchTime(subwallet._id, hours);
      toast.success(`Watch time extended by ${hours} hours`);
      fetchData();
    } catch (error) {
      toast.error('Failed to extend watch time');
    }
  };

  // Filter subwallets
  const filteredSubwallets = subwallets.filter(sw => {
    if (filter.status && sw.status !== filter.status) return false;
    if (filter.activity === 'minted' && (!sw.activity?.mintedTokens || sw.activity.mintedTokens.length === 0)) return false;
    if (filter.activity === 'pool' && (!sw.activity?.createdPools || sw.activity.createdPools.length === 0)) return false;
    if (filter.activity === 'bought' && (!sw.activity?.tokenPurchases || sw.activity.tokenPurchases.length === 0)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return sw.address.toLowerCase().includes(query);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Subwallets</h1>
          <p className="text-dark-400">Monitor discovered subwallets for mints and pools</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw size={16} />
            Refresh
          </button>
          {analyzerStatus.isRunning ? (
            <button onClick={handleStopAnalyzer} className="btn btn-danger flex items-center gap-2">
              <Square size={16} />
              Stop Analyzer
            </button>
          ) : (
            <button onClick={handleStartAnalyzer} className="btn btn-success flex items-center gap-2">
              <Play size={16} />
              Start Analyzer
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          label="Total Subwallets" 
          value={stats?.total || 0}
          icon={Search}
        />
        <StatCard 
          label="Watching" 
          value={stats?.watching || 0}
          icon={Eye}
          color="primary"
        />
        <StatCard 
          label="Mints Detected" 
          value={stats?.totalMints || 0}
          icon={Zap}
          color="purple"
        />
        <StatCard 
          label="Pools Created" 
          value={stats?.totalPools || 0}
          icon={Droplets}
          color="cyan"
        />
        <StatCard 
          label="Analyzer" 
          value={analyzerStatus.isRunning ? 'Running' : 'Stopped'}
          icon={analyzerStatus.isRunning ? Play : Square}
          color={analyzerStatus.isRunning ? 'success' : 'error'}
          isStatus
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subwallet List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
              <input
                type="text"
                placeholder="Search by address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
            <select
              value={filter.status}
              onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
              className="input w-full sm:w-36"
            >
              <option value="">All Status</option>
              <option value="watching">Watching</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={filter.activity}
              onChange={(e) => setFilter(prev => ({ ...prev, activity: e.target.value }))}
              className="input w-full sm:w-36"
            >
              <option value="">All Activity</option>
              <option value="minted">Has Minted</option>
              <option value="pool">Created Pool</option>
              <option value="bought">Bought Tokens</option>
            </select>
          </div>

          {/* Subwallet Grid */}
          <div className="space-y-3">
            {loading ? (
              <div className="card p-8 text-center">
                <div className="spinner mx-auto"></div>
              </div>
            ) : filteredSubwallets.length === 0 ? (
              <div className="card p-8 text-center">
                <Search className="mx-auto text-dark-500 mb-2" size={32} />
                <p className="text-dark-400">No subwallets found</p>
                <p className="text-dark-500 text-sm">Subwallets will appear when detected from hot wallet transfers</p>
              </div>
            ) : (
              filteredSubwallets.map((subwallet) => (
                <SubwalletCard
                  key={subwallet._id}
                  subwallet={subwallet}
                  onSelect={() => setSelectedSubwallet(subwallet)}
                  onExtend={(hours) => handleExtendWatch(subwallet, hours)}
                />
              ))
            )}
          </div>
        </div>

        {/* Mint Feed */}
        <div className="lg:col-span-1">
          <MintFeed mints={recentMints} />
        </div>
      </div>

      {/* Detail Modal */}
      {selectedSubwallet && (
        <SubwalletDetail
          subwallet={selectedSubwallet}
          onClose={() => setSelectedSubwallet(null)}
        />
      )}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, icon: Icon, color = 'default', isStatus = false }) => {
  const colorClasses = {
    default: 'text-white',
    primary: 'text-primary-400',
    success: 'text-success',
    error: 'text-error',
    purple: 'text-accent-purple',
    cyan: 'text-accent-cyan',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-dark-400 text-sm">{label}</p>
          <p className={`text-xl font-bold ${colorClasses[color]}`}>{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          color === 'success' ? 'bg-success/20' :
          color === 'error' ? 'bg-error/20' :
          color === 'purple' ? 'bg-accent-purple/20' :
          color === 'cyan' ? 'bg-accent-cyan/20' :
          'bg-primary-600/20'
        }`}>
          <Icon className={colorClasses[color] || 'text-primary-400'} size={20} />
        </div>
      </div>
    </div>
  );
};

// Subwallet Card Component
const SubwalletCard = ({ subwallet, onSelect, onExtend }) => {
  const shortenAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  
  const getStatusBadge = (status) => {
    const variants = {
      watching: 'success',
      active: 'primary',
      expired: 'warning',
      archived: 'default'
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const getTimeRemaining = () => {
    if (!subwallet.watchUntil) return null;
    const remaining = new Date(subwallet.watchUntil) - new Date();
    if (remaining <= 0) return 'Expired';
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const mintCount = subwallet.activity?.mintedTokens?.length || 0;
  const poolCount = subwallet.activity?.createdPools?.length || 0;
  const buyCount = subwallet.activity?.tokenPurchases?.length || 0;

  return (
    <div className="card p-4 hover:border-dark-600 transition-all cursor-pointer" onClick={onSelect}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-white">{shortenAddress(subwallet.address)}</span>
            <a
              href={`https://solscan.io/account/${subwallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dark-500 hover:text-primary-400"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={14} />
            </a>
          </div>
          <p className="text-xs text-dark-500">
            From: {subwallet.sourceExchange || 'Unknown'} • {subwallet.initialTransferAmount?.toFixed(2) || 0} SOL
          </p>
        </div>
        {getStatusBadge(subwallet.status)}
      </div>

      {/* Activity Badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        {mintCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-accent-purple/20 rounded text-xs text-accent-purple">
            <Zap size={12} />
            {mintCount} mint{mintCount > 1 ? 's' : ''}
          </div>
        )}
        {poolCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-accent-cyan/20 rounded text-xs text-accent-cyan">
            <Droplets size={12} />
            {poolCount} pool{poolCount > 1 ? 's' : ''}
          </div>
        )}
        {buyCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-success/20 rounded text-xs text-success">
            <ShoppingCart size={12} />
            {buyCount} buy{buyCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-dark-400">
          <Clock size={12} />
          {getTimeRemaining() || 'No expiry'}
        </div>
        {subwallet.status === 'watching' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExtend(24);
            }}
            className="flex items-center gap-1 text-primary-400 hover:text-primary-300"
          >
            <Timer size={12} />
            Extend
          </button>
        )}
      </div>
    </div>
  );
};

export default Subwallets;
