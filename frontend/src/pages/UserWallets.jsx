import { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Play, 
  Square, 
  RefreshCw,
  ExternalLink,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Bell,
  Zap,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Filter
} from 'lucide-react';
import { userWalletApi } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import toast from 'react-hot-toast';
import AddUserWalletModal from '../components/userwallets/AddUserWalletModal';
import SignalFeed from '../components/userwallets/SignalFeed';
import WalletSignals from '../components/userwallets/WalletSignals';
import { Badge } from '../components/common';

const UserWallets = () => {
  const { on, subscribe } = useWebSocket();
  
  const [wallets, setWallets] = useState([]);
  const [signals, setSignals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [filter, setFilter] = useState({ isActive: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data on mount
  useEffect(() => {
    fetchData();
    subscribe('user-wallets');
  }, []);

  // Subscribe to real-time signals
  useEffect(() => {
    const unsub = on('userWallet:signal', (data) => {
      setSignals(prev => [data, ...prev.slice(0, 49)]);
      
      // Show toast based on signal type
      const toastConfig = {
        mint: { icon: '🎉', message: 'Mint detected' },
        buy: { icon: '🟢', message: 'Buy signal' },
        sell: { icon: '🔴', message: 'Sell signal' },
        pool_created: { icon: '💧', message: 'Pool created' },
        large_transfer: { icon: '💰', message: 'Large transfer' },
      };
      
      const config = toastConfig[data.signalType] || { icon: '📡', message: 'Signal detected' };
      toast.success(`${config.message}: ${data.walletLabel || 'Wallet'}`, { icon: config.icon });
    });

    return () => unsub();
  }, [on]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [walletsRes, statsRes, signalsRes] = await Promise.all([
        userWalletApi.getAll(),
        userWalletApi.getStats(),
        userWalletApi.getAllSignals({ limit: 50 })
      ]);

      setWallets(walletsRes.data.data);
      setStats(statsRes.data.data);
      setSignals(signalsRes.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch wallets');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWallet = async (wallet) => {
    try {
      await userWalletApi.toggle(wallet._id);
      setWallets(prev => prev.map(w => 
        w._id === wallet._id ? { ...w, isActive: !w.isActive } : w
      ));
      toast.success(`Wallet ${wallet.isActive ? 'disabled' : 'enabled'}`);
    } catch (error) {
      toast.error('Failed to toggle wallet');
    }
  };

  const handleDeleteWallet = async (wallet) => {
    if (!confirm(`Remove ${wallet.label || wallet.address}?`)) return;
    
    try {
      await userWalletApi.remove(wallet._id);
      setWallets(prev => prev.filter(w => w._id !== wallet._id));
      toast.success('Wallet removed');
    } catch (error) {
      toast.error('Failed to delete wallet');
    }
  };

  const handleWalletAdded = (newWallet) => {
    setWallets(prev => [newWallet, ...prev]);
    setShowAddModal(false);
    toast.success('Wallet added');
  };

  // Filter wallets
  const filteredWallets = wallets.filter(wallet => {
    if (filter.isActive === 'active' && !wallet.isActive) return false;
    if (filter.isActive === 'inactive' && wallet.isActive) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        wallet.address.toLowerCase().includes(query) ||
        wallet.label?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Wallets</h1>
          <p className="text-dark-400">Track wallets and receive trading signals</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw size={16} />
            Refresh
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary flex items-center gap-2">
            <Plus size={16} />
            Add Wallet
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total Wallets" 
          value={stats?.totalWallets || 0}
          icon={Users}
        />
        <StatCard 
          label="Active Tracking" 
          value={stats?.activeWallets || 0}
          icon={Bell}
          color="success"
        />
        <StatCard 
          label="Total Signals" 
          value={stats?.totalSignals || 0}
          icon={Zap}
          color="purple"
        />
        <StatCard 
          label="Signals Today" 
          value={stats?.signalsToday || 0}
          icon={TrendingUp}
          color="primary"
        />
      </div>

      {/* Signal Type Breakdown */}
      {stats?.signalsByType && Object.keys(stats.signalsByType).length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-white mb-3">Signal Breakdown</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.signalsByType).map(([type, count]) => (
              <SignalTypeBadge key={type} type={type} count={count} />
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wallet List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
              <input
                type="text"
                placeholder="Search wallets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
            <select
              value={filter.isActive}
              onChange={(e) => setFilter(prev => ({ ...prev, isActive: e.target.value }))}
              className="input w-full sm:w-32"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Wallet List */}
          <div className="space-y-3">
            {loading ? (
              <div className="card p-8 text-center">
                <div className="spinner mx-auto"></div>
              </div>
            ) : filteredWallets.length === 0 ? (
              <div className="card p-8 text-center">
                <Users className="mx-auto text-dark-500 mb-2" size={32} />
                <p className="text-dark-400">No wallets tracked</p>
                <p className="text-dark-500 text-sm mb-4">Add wallets to receive trading signals</p>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="btn btn-primary"
                >
                  Add Your First Wallet
                </button>
              </div>
            ) : (
              filteredWallets.map((wallet) => (
                <WalletCard
                  key={wallet._id}
                  wallet={wallet}
                  onToggle={() => handleToggleWallet(wallet)}
                  onDelete={() => handleDeleteWallet(wallet)}
                  onViewSignals={() => setSelectedWallet(wallet)}
                />
              ))
            )}
          </div>
        </div>

        {/* Signal Feed */}
        <div className="lg:col-span-1">
          <SignalFeed signals={signals} />
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddUserWalletModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleWalletAdded}
        />
      )}

      {/* Wallet Signals Modal */}
      {selectedWallet && (
        <WalletSignals
          wallet={selectedWallet}
          onClose={() => setSelectedWallet(null)}
        />
      )}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, icon: Icon, color = 'default' }) => {
  const colorClasses = {
    default: 'text-white',
    primary: 'text-primary-400',
    success: 'text-success',
    purple: 'text-accent-purple',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-dark-400 text-sm">{label}</p>
          <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          color === 'success' ? 'bg-success/20' :
          color === 'purple' ? 'bg-accent-purple/20' :
          'bg-primary-600/20'
        }`}>
          <Icon className={colorClasses[color] || 'text-primary-400'} size={20} />
        </div>
      </div>
    </div>
  );
};

// Signal Type Badge
const SignalTypeBadge = ({ type, count }) => {
  const config = {
    mint: { color: 'purple', icon: Zap, label: 'Mints' },
    buy: { color: 'success', icon: TrendingUp, label: 'Buys' },
    sell: { color: 'error', icon: TrendingDown, label: 'Sells' },
    pool_created: { color: 'info', icon: ArrowUpRight, label: 'Pools' },
    large_transfer: { color: 'warning', icon: ArrowDownRight, label: 'Transfers' },
  };

  const conf = config[type] || { color: 'default', icon: Bell, label: type };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
      conf.color === 'purple' ? 'bg-accent-purple/20 text-accent-purple' :
      conf.color === 'success' ? 'bg-success/20 text-success' :
      conf.color === 'error' ? 'bg-error/20 text-error' :
      conf.color === 'info' ? 'bg-info/20 text-info' :
      conf.color === 'warning' ? 'bg-warning/20 text-warning' :
      'bg-dark-700 text-dark-300'
    }`}>
      <conf.icon size={14} />
      <span className="text-sm font-medium">{conf.label}</span>
      <span className="text-sm opacity-70">{count}</span>
    </div>
  );
};

// Wallet Card Component
const WalletCard = ({ wallet, onToggle, onDelete, onViewSignals }) => {
  const shortenAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const signalCount = wallet.signals?.length || 0;

  return (
    <div className="card p-4 hover:border-dark-600 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white">{wallet.label || 'Unnamed Wallet'}</h3>
            {wallet.isActive && (
              <span className="status-dot status-dot-success"></span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-sm text-dark-400">{shortenAddress(wallet.address)}</span>
            <a
              href={`https://solscan.io/account/${wallet.address}`}
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
            onClick={onToggle}
            className={`p-2 rounded-lg transition-colors ${
              wallet.isActive 
                ? 'text-success hover:bg-success/10' 
                : 'text-dark-400 hover:bg-dark-700'
            }`}
            title={wallet.isActive ? 'Disable tracking' : 'Enable tracking'}
          >
            {wallet.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-dark-400 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
            title="Remove wallet"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-dark-400">
            <span className="text-white font-medium">{signalCount}</span> signals
          </span>
          {wallet.notes && (
            <span className="text-dark-500 truncate max-w-[200px]">{wallet.notes}</span>
          )}
        </div>
        {signalCount > 0 && (
          <button
            onClick={onViewSignals}
            className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
          >
            View Signals
            <ArrowUpRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default UserWallets;
