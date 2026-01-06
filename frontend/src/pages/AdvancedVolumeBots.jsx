import { useState, useEffect } from 'react';
import {
  Bot,
  Zap,
  Repeat,
  Play,
  Square,
  TrendingUp,
  Wallet,
  Activity,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdvancedVolumeBots = () => {
  const [activeTab, setActiveTab] = useState('enhanced'); // 'enhanced' or 'recycling'
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Enhanced Bot Form State
  const [enhancedForm, setEnhancedForm] = useState({
    tokenMint: '',
    fundingWalletPrivateKey: '',
    config: {
      walletCount: 10,
      solPerWallet: 0.3,
      tokensPerWallet: 10000,
      liquiditySOL: 0.5,
      liquidityTokens: 50000,
      tradesPerMinute: 5,
      durationMinutes: 60,
      minTradeAmount: 100,
      maxTradeAmount: 1000
    }
  });

  // Recycling Bot Form State
  const [recyclingForm, setRecyclingForm] = useState({
    tokenMint: '',
    fundingWalletPrivateKey: '',
    config: {
      startingCapital: 1.0,
      walletCount: 20,
      tradesPerMinute: 20,
      targetVolume: 20,
      maxLossPercent: 20,
      durationMinutes: 60,
      buyRatio: 0.6,
      minTradeSize: 0.01,
      maxTradeSize: 0.05
    }
  });

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [activeTab]);

  const loadSessions = async () => {
    try {
      const endpoint = activeTab === 'enhanced'
        ? '/api/enhanced-volume/sessions'
        : '/api/recycling-volume/sessions';

      const response = await fetch(`http://localhost:5001${endpoint}`);
      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const startEnhancedBot = async () => {
    if (!enhancedForm.tokenMint || !enhancedForm.fundingWalletPrivateKey) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5001/api/enhanced-volume/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enhancedForm)
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Enhanced volume bot started successfully!');
        loadSessions();
        // Reset form
        setEnhancedForm({
          ...enhancedForm,
          tokenMint: '',
          fundingWalletPrivateKey: ''
        });
      } else {
        toast.error(data.message || 'Failed to start bot');
      }
    } catch (error) {
      toast.error('Error starting bot: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startRecyclingBot = async () => {
    if (!recyclingForm.tokenMint || !recyclingForm.fundingWalletPrivateKey) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5001/api/recycling-volume/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recyclingForm)
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Recycling volume bot started successfully!');
        loadSessions();
        // Reset form
        setRecyclingForm({
          ...recyclingForm,
          tokenMint: '',
          fundingWalletPrivateKey: ''
        });
      } else {
        toast.error(data.message || 'Failed to start bot');
      }
    } catch (error) {
      toast.error('Error starting bot: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const stopSession = async (sessionId) => {
    try {
      const endpoint = activeTab === 'enhanced'
        ? `/api/enhanced-volume/sessions/${sessionId}/stop`
        : `/api/recycling-volume/session/${sessionId}/stop`;

      const response = await fetch(`http://localhost:5001${endpoint}`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Session stopped');
        loadSessions();
      } else {
        toast.error('Failed to stop session');
      }
    } catch (error) {
      toast.error('Error stopping session');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Bot className="text-purple-500" size={40} />
            Advanced Volume Bots
          </h1>
          <p className="text-gray-400">
            Generate maximum trading volume with intelligent bot strategies
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6 bg-gray-800 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setActiveTab('enhanced')}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'enhanced'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Zap size={18} />
            Enhanced Bot
            <span className="text-xs bg-purple-500/30 px-2 py-0.5 rounded">With Liquidity</span>
          </button>
          <button
            onClick={() => setActiveTab('recycling')}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'recycling'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Repeat size={18} />
            Recycling Bot
            <span className="text-xs bg-blue-500/30 px-2 py-0.5 rounded">Max Volume</span>
          </button>
        </div>

        {/* Enhanced Volume Bot */}
        {activeTab === 'enhanced' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                  <Zap className="text-purple-400" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">Enhanced Volume Bot</h2>
                  <p className="text-gray-400 text-sm">
                    Creates 10 wallets, adds liquidity, and generates organic trading volume
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Configuration */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg mb-3">Configuration</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Token Mint Address *
                    </label>
                    <input
                      type="text"
                      value={enhancedForm.tokenMint}
                      onChange={(e) => setEnhancedForm({ ...enhancedForm, tokenMint: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter token mint address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Funding Wallet Private Key *
                    </label>
                    <textarea
                      value={enhancedForm.fundingWalletPrivateKey}
                      onChange={(e) => setEnhancedForm({ ...enhancedForm, fundingWalletPrivateKey: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                      rows={3}
                      placeholder="Base58 or JSON array format"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Wallet Count
                      </label>
                      <input
                        type="number"
                        value={enhancedForm.config.walletCount || ''}
                        onChange={(e) => setEnhancedForm({
                          ...enhancedForm,
                          config: { ...enhancedForm.config, walletCount: parseInt(e.target.value) || 10 }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                        min="2"
                        max="20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        SOL per Wallet
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={enhancedForm.config.solPerWallet || ''}
                        onChange={(e) => setEnhancedForm({
                          ...enhancedForm,
                          config: { ...enhancedForm.config, solPerWallet: parseFloat(e.target.value) || 0.3 }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                        min="0.01"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Liquidity SOL
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={enhancedForm.config.liquiditySOL}
                        onChange={(e) => setEnhancedForm({
                          ...enhancedForm,
                          config: { ...enhancedForm.config, liquiditySOL: parseFloat(e.target.value) }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Liquidity Tokens
                      </label>
                      <input
                        type="number"
                        value={enhancedForm.config.liquidityTokens}
                        onChange={(e) => setEnhancedForm({
                          ...enhancedForm,
                          config: { ...enhancedForm.config, liquidityTokens: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Trades/Minute
                      </label>
                      <input
                        type="number"
                        value={enhancedForm.config.tradesPerMinute}
                        onChange={(e) => setEnhancedForm({
                          ...enhancedForm,
                          config: { ...enhancedForm.config, tradesPerMinute: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Duration (minutes)
                      </label>
                      <input
                        type="number"
                        value={enhancedForm.config.durationMinutes}
                        onChange={(e) => setEnhancedForm({
                          ...enhancedForm,
                          config: { ...enhancedForm.config, durationMinutes: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    onClick={startEnhancedBot}
                    disabled={loading}
                    className="w-full mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="animate-spin" size={20} />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play size={20} />
                        Start Enhanced Bot
                      </>
                    )}
                  </button>
                </div>

                {/* Right Column - Info */}
                <div className="bg-gray-700/50 rounded-lg p-5">
                  <h3 className="font-semibold mb-4">How It Works</h3>
                  <div className="space-y-3 text-sm text-gray-300">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                        1
                      </div>
                      <div>
                        <p className="font-medium text-white">Create Wallets</p>
                        <p className="text-gray-400">Generates multiple trading wallets</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                        2
                      </div>
                      <div>
                        <p className="font-medium text-white">Fund Wallets</p>
                        <p className="text-gray-400">Distributes SOL and tokens</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                        3
                      </div>
                      <div>
                        <p className="font-medium text-white">Create Liquidity</p>
                        <p className="text-gray-400">First wallet creates liquidity pool</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                        4
                      </div>
                      <div>
                        <p className="font-medium text-white">Generate Volume</p>
                        <p className="text-gray-400">All wallets buy/sell continuously</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-purple-600/20 border border-purple-600/30 rounded-lg">
                    <p className="text-xs text-purple-300">
                      <strong>Total SOL Needed:</strong> {' '}
                      {(enhancedForm.config.walletCount * enhancedForm.config.solPerWallet +
                        enhancedForm.config.liquiditySOL + 0.1).toFixed(2)} SOL
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Sessions */}
            <SessionsList sessions={sessions} onStop={stopSession} type="enhanced" />
          </div>
        )}

        {/* Recycling Volume Bot */}
        {activeTab === 'recycling' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <Repeat className="text-blue-400" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">Recycling Volume Bot</h2>
                  <p className="text-gray-400 text-sm">
                    Generates 10-20x volume by recycling the same capital through buy/sell cycles
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Configuration */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg mb-3">Configuration</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Token Mint Address *
                    </label>
                    <input
                      type="text"
                      value={recyclingForm.tokenMint}
                      onChange={(e) => setRecyclingForm({ ...recyclingForm, tokenMint: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter token mint address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Funding Wallet Private Key *
                    </label>
                    <textarea
                      value={recyclingForm.fundingWalletPrivateKey}
                      onChange={(e) => setRecyclingForm({ ...recyclingForm, fundingWalletPrivateKey: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      rows={3}
                      placeholder="Base58 or JSON array format"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Starting Capital (SOL)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={recyclingForm.config.startingCapital || ''}
                        onChange={(e) => setRecyclingForm({
                          ...recyclingForm,
                          config: { ...recyclingForm.config, startingCapital: parseFloat(e.target.value) || 1.0 }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Target Volume (SOL)
                      </label>
                      <input
                        type="number"
                        value={recyclingForm.config.targetVolume}
                        onChange={(e) => setRecyclingForm({
                          ...recyclingForm,
                          config: { ...recyclingForm.config, targetVolume: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Wallet Count
                      </label>
                      <input
                        type="number"
                        value={recyclingForm.config.walletCount || ''}
                        onChange={(e) => setRecyclingForm({
                          ...recyclingForm,
                          config: { ...recyclingForm.config, walletCount: parseInt(e.target.value) || 20 }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Max Loss %
                      </label>
                      <input
                        type="number"
                        value={recyclingForm.config.maxLossPercent}
                        onChange={(e) => setRecyclingForm({
                          ...recyclingForm,
                          config: { ...recyclingForm.config, maxLossPercent: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Trades/Minute
                      </label>
                      <input
                        type="number"
                        value={recyclingForm.config.tradesPerMinute}
                        onChange={(e) => setRecyclingForm({
                          ...recyclingForm,
                          config: { ...recyclingForm.config, tradesPerMinute: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Duration (minutes)
                      </label>
                      <input
                        type="number"
                        value={recyclingForm.config.durationMinutes}
                        onChange={(e) => setRecyclingForm({
                          ...recyclingForm,
                          config: { ...recyclingForm.config, durationMinutes: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    onClick={startRecyclingBot}
                    disabled={loading}
                    className="w-full mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="animate-spin" size={20} />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play size={20} />
                        Start Recycling Bot
                      </>
                    )}
                  </button>
                </div>

                {/* Right Column - Info */}
                <div className="bg-gray-700/50 rounded-lg p-5">
                  <h3 className="font-semibold mb-4">Strategy</h3>
                  <div className="space-y-3 text-sm text-gray-300">
                    <div className="flex gap-3">
                      <Repeat className="text-blue-400 flex-shrink-0" size={20} />
                      <div>
                        <p className="font-medium text-white">Buy → Sell → Repeat</p>
                        <p className="text-gray-400">Same capital generates 10-20x volume</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Activity className="text-blue-400 flex-shrink-0" size={20} />
                      <div>
                        <p className="font-medium text-white">High Frequency</p>
                        <p className="text-gray-400">Rapid cycling for maximum output</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <AlertCircle className="text-blue-400 flex-shrink-0" size={20} />
                      <div>
                        <p className="font-medium text-white">Loss Control</p>
                        <p className="text-gray-400">Stops at max loss threshold</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-2">
                    <div className="p-4 bg-blue-600/20 border border-blue-600/30 rounded-lg">
                      <p className="text-xs text-blue-300">
                        <strong>Volume Multiplier:</strong> {' '}
                        {recyclingForm.config.targetVolume / recyclingForm.config.startingCapital}x
                      </p>
                    </div>
                    <div className="p-4 bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-300">
                        <strong>Total SOL Needed:</strong> {' '}
                        {(recyclingForm.config.startingCapital + 0.1).toFixed(2)} SOL
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Sessions */}
            <SessionsList sessions={sessions} onStop={stopSession} type="recycling" />
          </div>
        )}
      </div>
    </div>
  );
};

// Sessions List Component
const SessionsList = ({ sessions, onStop, type }) => {
  if (sessions.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
        <Activity className="mx-auto text-gray-600 mb-3" size={48} />
        <h3 className="text-lg font-medium text-gray-400">No Active Sessions</h3>
        <p className="text-gray-500 text-sm mt-1">Start a bot to see active sessions here</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Activity size={24} />
        Active Sessions ({sessions.length})
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sessions.map((session, index) => (
          <SessionCard key={index} session={session} onStop={onStop} type={type} />
        ))}
      </div>
    </div>
  );
};

// Session Card Component
const SessionCard = ({ session, onStop, type }) => {
  const getStatusColor = (status) => {
    if (status === 'running') return 'text-green-400';
    if (status === 'stopped') return 'text-red-400';
    return 'text-yellow-400';
  };

  const getStatusIcon = (status) => {
    if (status === 'running') return <CheckCircle size={16} />;
    if (status === 'stopped') return <XCircle size={16} />;
    return <Clock size={16} />;
  };

  return (
    <div className="bg-gray-700/50 rounded-lg p-5 border border-gray-600 hover:border-gray-500 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">Session ID</p>
          <p className="font-mono text-sm">{session.sessionId?.substring(0, 20)}...</p>
        </div>
        <div className={`flex items-center gap-1.5 ${getStatusColor(session.status)}`}>
          {getStatusIcon(session.status)}
          <span className="text-sm font-medium capitalize">{session.status}</span>
        </div>
      </div>

      {type === 'recycling' && session.session && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Total Volume</p>
            <p className="font-semibold">{session.session.metrics?.totalVolume?.toFixed(2)} SOL</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Multiplier</p>
            <p className="font-semibold">{session.session.metrics?.volumeMultiplier?.toFixed(1)}x</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Total Trades</p>
            <p className="font-semibold">{session.session.metrics?.totalTrades || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Capital Loss</p>
            <p className="font-semibold text-red-400">{session.session.capital?.lossPercent?.toFixed(2)}%</p>
          </div>
        </div>
      )}

      {type === 'enhanced' && session.session && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Total Volume</p>
            <p className="font-semibold">{session.session.stats?.totalVolume?.toFixed(2)} SOL</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Total Trades</p>
            <p className="font-semibold">{session.session.stats?.totalTrades || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Buys / Sells</p>
            <p className="font-semibold text-green-400">{session.session.stats?.buys || 0}</p>
            <p className="font-semibold text-red-400 inline ml-1">/ {session.session.stats?.sells || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Wallets</p>
            <p className="font-semibold">{session.session.wallets?.length || 0}</p>
          </div>
        </div>
      )}

      {session.status === 'running' && (
        <button
          onClick={() => onStop(session.sessionId || session.id)}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Square size={16} />
          Stop Session
        </button>
      )}
    </div>
  );
};

export default AdvancedVolumeBots;
