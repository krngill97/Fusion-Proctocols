import { useState, useEffect } from 'react';
import { 
  Wallet, 
  Plus, 
  Play, 
  Square, 
  RefreshCw,
  ExternalLink,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Search,
  ArrowUpRight,
  Clock,
  Filter
} from 'lucide-react';
import { hotWalletApi } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import toast from 'react-hot-toast';
import AddHotWalletModal from '../components/hotwallets/AddHotWalletModal';
import TransferFeed from '../components/hotwallets/TransferFeed';

const HotWallets = () => {
  const { on, subscribe } = useWebSocket();
  
  const [wallets, setWallets] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [stats, setStats] = useState(null);
  const [trackerStatus, setTrackerStatus] = useState({ isRunning: false });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState({ exchange: '', isActive: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data on mount
  useEffect(() => {
    fetchData();
    subscribe('hot-wallets');
  }, []);

  // Subscribe to real-time transfers
  useEffect(() => {
    const unsub = on('hotWallet:transfer', (data) => {
      setTransfers(prev => [data, ...prev.slice(0, 49)]);
      toast.success(`Transfer detected: ${data.amount} SOL`, { icon: '💸' });
    });

    return () => unsub();
  }, [on]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [walletsRes, statsRes, statusRes, transfersRes] = await Promise.all([
        hotWalletApi.getAll(),
        hotWalletApi.getStats(),
        hotWalletApi.getTrackerStatus(),
        hotWalletApi.getTransfers({ limit: 50 })
      ]);

      setWallets(walletsRes.data.data);
      setStats(statsRes.data.data);
      setTrackerStatus(statusRes.data.data);
      setTransfers(transfersRes.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch hot wallets');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTracker = async () => {
    try {
      await hotWalletApi.startTracker();
      setTrackerStatus({ isRunning: true });
      toast.success('Tracker started');
    } catch (error) {
      toast.error('Failed to start tracker');
    }
  };

  const handleStopTracker = async () => {
    try {
      await hotWalletApi.stopTracker();
      setTrackerStatus({ isRunning: false });
      toast.success('Tracker stopped');
    } catch (error) {
      toast.error('Failed to stop tracker');
    }
  };

  const handleToggleWallet = async (wallet) => {
    try {
      await hotWalletApi.toggle(wallet._id);
      setWallets(prev => prev.map(w => 
        w._id === wallet._id ? { ...w, isActive: !w.isActive } : w
      ));
      toast.success(`Wallet ${wallet.isActive ? 'disabled' : 'enabled'}`);
    } catch (error) {
      toast.error('Failed to toggle wallet');
    }
  };

  const handleDeleteWallet = async (wallet) => {
    if (!confirm(`Delete ${wallet.label || wallet.address}?`)) return;
    
    try {
      await hotWalletApi.remove(wallet._id);
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
    if (filter.exchange && wallet.exchange !== filter.exchange) return false;
    if (filter.isActive === 'active' && !wallet.isActive) return false;
    if (filter.isActive === 'inactive' && wallet.isActive) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        wallet.address.toLowerCase().includes(query) ||
        wallet.label?.toLowerCase().includes(query) ||
        wallet.exchange?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const exchanges = [...new Set(wallets.map(w => w.exchange).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Hot Wallets</h1>
          <p className="text-dark-400">Monitor exchange hot wallets for transfers</p>
        </div>
        <div className="flex items-center gap-3">
          {trackerStatus.isRunning ? (
            <button onClick={handleStopTracker} className="btn btn-danger flex items-center gap-2">
              <Square size={16} />
              Stop Tracker
            </button>
          ) : (
            <button onClick={handleStartTracker} className="btn btn-success flex items-center gap-2">
              <Play size={16} />
              Start Tracker
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary flex items-center gap-2">
            <Plus size={16} />
            Add Wallet
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-dark-400 text-sm">Total Wallets</p>
          <p className="text-2xl font-bold text-white">{stats?.totalWallets || 0}</p>
        </div>
        <div className="card">
          <p className="text-dark-400 text-sm">Active Tracking</p>
          <p className="text-2xl font-bold text-success">{stats?.activeWallets || 0}</p>
        </div>
        <div className="card">
          <p className="text-dark-400 text-sm">Transfers Today</p>
          <p className="text-2xl font-bold text-primary-400">{stats?.transfersToday || 0}</p>
        </div>
        <div className="card">
          <p className="text-dark-400 text-sm">Tracker Status</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`status-dot ${trackerStatus.isRunning ? 'status-dot-success' : 'status-dot-error'}`}></span>
            <span className={`font-semibold ${trackerStatus.isRunning ? 'text-success' : 'text-error'}`}>
              {trackerStatus.isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
        </div>
      </div>

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
              value={filter.exchange}
              onChange={(e) => setFilter(prev => ({ ...prev, exchange: e.target.value }))}
              className="input w-full sm:w-40"
            >
              <option value="">All Exchanges</option>
              {exchanges.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
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

          {/* Wallet Table */}
          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="spinner mx-auto"></div>
              </div>
            ) : filteredWallets.length === 0 ? (
              <div className="p-8 text-center">
                <Wallet className="mx-auto text-dark-500 mb-2" size={32} />
                <p className="text-dark-400">No hot wallets found</p>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="btn btn-primary mt-4"
                >
                  Add Your First Wallet
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Wallet</th>
                      <th>Exchange</th>
                      <th>Transfers</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWallets.map((wallet) => (
                      <WalletRow
                        key={wallet._id}
                        wallet={wallet}
                        onToggle={handleToggleWallet}
                        onDelete={handleDeleteWallet}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Transfer Feed */}
        <div className="lg:col-span-1">
          <TransferFeed transfers={transfers} />
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddHotWalletModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleWalletAdded}
        />
      )}
    </div>
  );
};

// Wallet Row Component
const WalletRow = ({ wallet, onToggle, onDelete }) => {
  const shortenAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <tr>
      <td>
        <div>
          <p className="font-medium text-white">{wallet.label || 'Unnamed'}</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-dark-400">
              {shortenAddress(wallet.address)}
            </span>
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
      </td>
      <td>
        <span className="badge badge-primary">{wallet.exchange || 'Unknown'}</span>
      </td>
      <td>
        <span className="text-white">{wallet.stats?.transferCount || 0}</span>
      </td>
      <td>
        <button
          onClick={() => onToggle(wallet)}
          className={`flex items-center gap-1 ${wallet.isActive ? 'text-success' : 'text-dark-400'}`}
        >
          {wallet.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          <span className="text-sm">{wallet.isActive ? 'Active' : 'Inactive'}</span>
        </button>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDelete(wallet)}
            className="p-1.5 text-dark-400 hover:text-error transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default HotWallets;
