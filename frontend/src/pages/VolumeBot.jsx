import { useState, useEffect } from 'react';
import {
  Bot,
  Plus,
  Play,
  Pause,
  Square,
  RefreshCw,
  Activity,
  Wallet,
  TrendingUp,
  Clock,
  Zap,
  TestTube
} from 'lucide-react';
import { volumeApi } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { useNetwork } from '../context/NetworkContext';
import toast from 'react-hot-toast';
import CreateSessionModal from '../components/volume/CreateSessionModal';
import SessionCard from '../components/volume/SessionCard';
import SessionDetail from '../components/volume/SessionDetail';
import { Badge } from '../components/common';

const VolumeBot = () => {
  const { on, subscribe } = useWebSocket();
  const { isTestnet } = useNetwork();

  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [filter, setFilter] = useState('all');

  // Fetch data on mount
  useEffect(() => {
    fetchData();
    subscribe('volume');
  }, []);

  // Subscribe to volume events
  useEffect(() => {
    const unsubProgress = on('volume:progress', (data) => {
      setSessions(prev => prev.map(s => 
        s._id === data.sessionId ? { ...s, ...data } : s
      ));
    });

    const unsubTransaction = on('volume:transaction', (data) => {
      toast.success(`Trade executed: ${data.type} ${data.amount?.toFixed(4)} SOL`, { icon: '🤖' });
    });

    const unsubCompleted = on('volume:completed', (data) => {
      toast.success('Volume session completed!', { icon: '✅' });
      fetchData();
    });

    return () => {
      unsubProgress();
      unsubTransaction();
      unsubCompleted();
    };
  }, [on]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sessionsRes, statusRes] = await Promise.all([
        volumeApi.getSessions({ limit: 50 }),
        volumeApi.getStatus()
      ]);

      setSessions(sessionsRes.data.data.sessions || sessionsRes.data.data);
      setStatus(statusRes.data.data);
    } catch (error) {
      toast.error('Failed to fetch volume data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionCreated = (newSession) => {
    setSessions(prev => [newSession, ...prev]);
    setShowCreateModal(false);
    toast.success('Session created');
  };

  const handleStartSession = async (session) => {
    try {
      await volumeApi.startSession(session._id);
      toast.success('Session started');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to start session');
    }
  };

  const handlePauseSession = async (session) => {
    try {
      await volumeApi.pauseSession(session._id);
      toast.success('Session paused');
      fetchData();
    } catch (error) {
      toast.error('Failed to pause session');
    }
  };

  const handleResumeSession = async (session) => {
    try {
      await volumeApi.resumeSession(session._id);
      toast.success('Session resumed');
      fetchData();
    } catch (error) {
      toast.error('Failed to resume session');
    }
  };

  const handleStopSession = async (session) => {
    if (!confirm('Stop this session? Remaining funds will be returned.')) return;
    
    try {
      await volumeApi.stopSession(session._id);
      toast.success('Session stopped');
      fetchData();
    } catch (error) {
      toast.error('Failed to stop session');
    }
  };

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    if (filter === 'all') return true;
    return session.status === filter;
  });

  // Calculate stats
  const activeSessions = sessions.filter(s => s.status === 'running').length;
  const totalVolume = sessions.reduce((sum, s) => sum + (s.stats?.totalVolume || 0), 0);
  const totalTrades = sessions.reduce((sum, s) => sum + (s.stats?.totalTrades || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Volume Bot</h1>
          <p className="text-dark-400">Generate organic trading volume for your tokens</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw size={16} />
            Refresh
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="btn btn-primary flex items-center gap-2"
            disabled={!status?.enabled}
          >
            <Plus size={16} />
            New Session
          </button>
        </div>
      </div>

      {/* Testnet Warning Banner */}
      {isTestnet && (
        <div className="bg-warning-900/20 border border-warning-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-warning-400 text-sm">
            <TestTube size={16} />
            <span className="font-medium">Testnet Mode</span>
          </div>
          <p className="text-xs text-dark-400 mt-1">
            You're running the volume bot on testnet. No real funds will be used.
          </p>
        </div>
      )}

      {/* Status Banner */}
      {!status?.enabled && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-center gap-3">
          <Bot className="text-warning" size={24} />
          <div>
            <p className="text-warning font-medium">Volume Bot Disabled</p>
            <p className="text-dark-400 text-sm">Enable the volume bot in settings to create sessions</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Active Sessions" 
          value={activeSessions}
          icon={Activity}
          color={activeSessions > 0 ? 'success' : 'default'}
        />
        <StatCard 
          label="Total Volume" 
          value={`${totalVolume.toFixed(2)} SOL`}
          icon={TrendingUp}
          color="primary"
        />
        <StatCard 
          label="Total Trades" 
          value={totalTrades}
          icon={Zap}
          color="purple"
        />
        <StatCard 
          label="Max Deposit" 
          value={`${status?.maxDepositSol || 50} SOL`}
          icon={Wallet}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'running', 'paused', 'pending', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-dark-800 text-dark-400 hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({sessions.filter(s => s.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="card p-12 text-center">
          <Bot className="mx-auto text-dark-500 mb-3" size={48} />
          <h3 className="text-lg font-medium text-white mb-1">No Sessions Found</h3>
          <p className="text-dark-400 mb-4">
            {filter === 'all' 
              ? 'Create your first volume generation session'
              : `No ${filter} sessions`
            }
          </p>
          {filter === 'all' && status?.enabled && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              Create Session
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSessions.map((session) => (
            <SessionCard
              key={session._id}
              session={session}
              onStart={() => handleStartSession(session)}
              onPause={() => handlePauseSession(session)}
              onResume={() => handleResumeSession(session)}
              onStop={() => handleStopSession(session)}
              onViewDetails={() => setSelectedSession(session)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleSessionCreated}
          maxDeposit={status?.maxDepositSol || 50}
        />
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <SessionDetail
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onRefresh={fetchData}
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
          <p className={`text-xl font-bold ${colorClasses[color]}`}>{value}</p>
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

export default VolumeBot;
