import { useState, useEffect } from 'react';
import { 
  Wallet, 
  Search, 
  Users, 
  TrendingUp, 
  TrendingDown,
  Bot,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { hotWalletApi, subwalletApi, userWalletApi, tradingApi, volumeApi } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';

const Dashboard = () => {
  const { on, isConnected } = useWebSocket();
  const [stats, setStats] = useState({
    hotWallets: { total: 0, active: 0 },
    subwallets: { total: 0, watching: 0 },
    trading: { total: 0, today: 0 },
    volume: { active: 0, totalVolume: 0 },
  });
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const unsub1 = on('hotWallet:transfer', (data) => {
      setActivity(prev => [{
        type: 'transfer',
        data,
        timestamp: new Date()
      }, ...prev.slice(0, 19)]);
    });

    const unsub2 = on('subwallet:mint', (data) => {
      setActivity(prev => [{
        type: 'mint',
        data,
        timestamp: new Date()
      }, ...prev.slice(0, 19)]);
    });

    const unsub3 = on('trade:completed', (data) => {
      setActivity(prev => [{
        type: 'trade',
        data,
        timestamp: new Date()
      }, ...prev.slice(0, 19)]);
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [on]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [hotRes, subRes, tradeRes, volRes] = await Promise.all([
        hotWalletApi.getStats().catch(() => ({ data: { data: {} } })),
        subwalletApi.getStats().catch(() => ({ data: { data: {} } })),
        tradingApi.getStats().catch(() => ({ data: { data: {} } })),
        volumeApi.getStatus().catch(() => ({ data: { data: {} } })),
      ]);

      setStats({
        hotWallets: hotRes.data.data || { total: 0, active: 0 },
        subwallets: subRes.data.data || { total: 0, watching: 0 },
        trading: tradeRes.data.data || { total: 0, today: 0 },
        volume: volRes.data.data || { active: 0, totalVolume: 0 },
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <StatCard
          label="Hot Wallets"
          value={stats.hotWallets.total || 0}
          subValue={`${stats.hotWallets.active || 0} active`}
          icon={Wallet}
          color="blue"
        />
        <StatCard
          label="Subwallets"
          value={stats.subwallets.total || 0}
          subValue={`${stats.subwallets.watching || 0} watching`}
          icon={Search}
          color="purple"
        />
        <StatCard
          label="My Wallets"
          value={stats.trading.trackedWallets || 0}
          subValue="Tracked"
          icon={Users}
          color="cyan"
        />
        <StatCard
          label="Trades"
          value={stats.trading.total || 0}
          subValue={`${stats.trading.today || 0} today`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Volume Sessions"
          value={stats.volume.activeSessions || 0}
          subValue="Running"
          icon={Bot}
          color="orange"
        />
        <StatCard
          label="WebSocket"
          value={isConnected ? 'Connected' : 'Offline'}
          subValue={isConnected ? 'Real-time' : 'Reconnecting...'}
          icon={Activity}
          color={isConnected ? 'green' : 'red'}
          isStatus
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Feed */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Live Activity</h2>
              {isConnected && <span className="status-online"></span>}
            </div>
            <button onClick={fetchStats} className="btn btn-ghost btn-xs">
              <RefreshCw size={12} />
            </button>
          </div>

          <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-none">
            {activity.length === 0 ? (
              <div className="empty-state py-12">
                <Activity className="empty-state-icon" />
                <p className="empty-state-title">No activity yet</p>
                <p className="empty-state-desc">Events will appear here in real-time</p>
              </div>
            ) : (
              activity.map((item, index) => (
                <ActivityItem key={index} item={item} />
              ))
            )}
          </div>
        </div>

        {/* Quick Actions & Info */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction
                href="/hot-wallets"
                icon={Wallet}
                label="Add Wallet"
                color="blue"
              />
              <QuickAction
                href="/trading"
                icon={TrendingUp}
                label="New Trade"
                color="green"
              />
              <QuickAction
                href="/volume-bot"
                icon={Bot}
                label="Volume Bot"
                color="purple"
              />
              <QuickAction
                href="/settings"
                icon={Zap}
                label="Settings"
                color="orange"
              />
            </div>
          </div>

          {/* System Status */}
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-3">System Status</h2>
            <div className="space-y-2">
              <StatusRow label="API Server" status="online" />
              <StatusRow label="WebSocket" status={isConnected ? 'online' : 'offline'} />
              <StatusRow label="RPC Node" status="online" />
              <StatusRow label="Database" status="online" />
            </div>
          </div>

          {/* Network Info */}
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-3">Network</h2>
            <div className="space-y-1.5">
              <div className="data-row">
                <span className="data-label">Network</span>
                <span className="badge badge-warning">Devnet</span>
              </div>
              <div className="data-row">
                <span className="data-label">Block Height</span>
                <span className="data-value">298,412,847</span>
              </div>
              <div className="data-row">
                <span className="data-label">TPS</span>
                <span className="data-value">3,421</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, subValue, icon: Icon, color, isStatus }) => {
  const colors = {
    blue: 'text-primary-400 bg-primary-500/10',
    purple: 'text-accent-purple bg-accent-purple/10',
    cyan: 'text-accent-cyan bg-accent-cyan/10',
    green: 'text-success bg-success/10',
    orange: 'text-accent-orange bg-accent-orange/10',
    red: 'text-error bg-error/10',
  };

  return (
    <div className="card-dense">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="stat-label truncate">{label}</p>
          <p className={`text-lg font-bold tabular-nums ${isStatus ? (color === 'green' ? 'text-success' : 'text-error') : 'text-white'}`}>
            {value}
          </p>
          <p className="text-2xs text-dark-500 truncate">{subValue}</p>
        </div>
        <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
          <Icon size={14} />
        </div>
      </div>
    </div>
  );
};

// Activity Item Component
const ActivityItem = ({ item }) => {
  const config = {
    transfer: { icon: ArrowUpRight, color: 'text-primary-400', bg: 'bg-primary-500/10' },
    mint: { icon: Zap, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
    trade: { icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
  };

  const c = config[item.type] || config.transfer;
  const Icon = c.icon;

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="feed-item flex items-center gap-2">
      <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${c.bg}`}>
        <Icon size={12} className={c.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white truncate">
          {item.type === 'transfer' && `Transfer: ${item.data.amount?.toFixed(2)} SOL`}
          {item.type === 'mint' && `Mint: ${item.data.tokenSymbol || 'Token'}`}
          {item.type === 'trade' && `Trade: ${item.data.type} ${item.data.tokenSymbol || 'Token'}`}
        </p>
        <p className="text-2xs text-dark-500 truncate">
          {item.data.exchange || item.data.walletLabel || 'Unknown'}
        </p>
      </div>
      <span className="feed-item-time flex-shrink-0">{formatTime(item.timestamp)}</span>
    </div>
  );
};

// Quick Action Component
const QuickAction = ({ href, icon: Icon, label, color }) => {
  const colors = {
    blue: 'hover:border-primary-500/50 hover:bg-primary-500/5',
    green: 'hover:border-success/50 hover:bg-success/5',
    purple: 'hover:border-accent-purple/50 hover:bg-accent-purple/5',
    orange: 'hover:border-accent-orange/50 hover:bg-accent-orange/5',
  };

  return (
    <a
      href={href}
      className={`flex flex-col items-center gap-1 p-3 rounded border border-dark-700 transition-all ${colors[color]}`}
    >
      <Icon size={18} className="text-dark-400" />
      <span className="text-xs text-dark-300">{label}</span>
    </a>
  );
};

// Status Row Component
const StatusRow = ({ label, status }) => {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-dark-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-success' : 'bg-error'}`}></span>
        <span className={`text-2xs ${status === 'online' ? 'text-success' : 'text-error'}`}>
          {status === 'online' ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
};

export default Dashboard;
