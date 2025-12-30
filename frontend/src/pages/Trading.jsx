import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  ArrowUpDown,
  Settings,
  History,
  Zap,
  Target,
  Shield,
  Copy,
  RefreshCw,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { tradingApi } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import toast from 'react-hot-toast';
import SwapPanel from '../components/trading/SwapPanel';
import TradeHistory from '../components/trading/TradeHistory';
import AutoTradeSettings from '../components/trading/AutoTradeSettings';
import { Badge } from '../components/common';

const Trading = () => {
  const { on, subscribe } = useWebSocket();
  
  const [activeTab, setActiveTab] = useState('swap');
  const [stats, setStats] = useState(null);
  const [autoStatus, setAutoStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
    subscribe('trading');
  }, []);

  // Subscribe to trade updates
  useEffect(() => {
    const unsubTrade = on('trade:completed', (data) => {
      toast.success(`Trade completed: ${data.type} ${data.tokenSymbol}`, { icon: '✅' });
      fetchData();
    });

    const unsubFailed = on('trade:failed', (data) => {
      toast.error(`Trade failed: ${data.error}`, { icon: '❌' });
    });

    return () => {
      unsubTrade();
      unsubFailed();
    };
  }, [on]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, autoStatusRes] = await Promise.all([
        tradingApi.getStats(),
        tradingApi.getAutoStatus()
      ]);

      setStats(statsRes.data.data);
      setAutoStatus(autoStatusRes.data.data);
    } catch (error) {
      console.error('Failed to fetch trading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'swap', label: 'Swap', icon: ArrowUpDown },
    { id: 'history', label: 'History', icon: History },
    { id: 'auto', label: 'Auto-Trade', icon: Zap },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Trading</h1>
          <p className="text-dark-400">Execute swaps and manage auto-trading strategies</p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          label="Total Trades" 
          value={stats?.totalTrades || 0}
          icon={ArrowUpDown}
        />
        <StatCard 
          label="Completed" 
          value={stats?.completedTrades || 0}
          icon={TrendingUp}
          color="success"
        />
        <StatCard 
          label="Buys" 
          value={stats?.totalBuys || 0}
          icon={TrendingUp}
          color="primary"
        />
        <StatCard 
          label="Sells" 
          value={stats?.totalSells || 0}
          icon={TrendingDown}
          color="error"
        />
        <StatCard 
          label="Auto-Trade" 
          value={autoStatus?.isRunning ? 'Active' : 'Inactive'}
          icon={Zap}
          color={autoStatus?.isRunning ? 'purple' : 'default'}
          isStatus
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-dark-700">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary-500 text-white'
                  : 'border-transparent text-dark-400 hover:text-white'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'swap' && <SwapPanel onTradeComplete={fetchData} />}
        {activeTab === 'history' && <TradeHistory />}
        {activeTab === 'auto' && <AutoTradeSettings status={autoStatus} onUpdate={fetchData} />}
      </div>
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
          'bg-primary-600/20'
        }`}>
          <Icon className={colorClasses[color] || 'text-primary-400'} size={20} />
        </div>
      </div>
    </div>
  );
};

export default Trading;
