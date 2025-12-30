import { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Server, 
  Shield, 
  Bell, 
  Wallet,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Globe,
  Zap,
  Bot,
  TrendingUp
} from 'lucide-react';
import { settingsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Badge } from '../components/common';

const Settings = () => {
  const { user, updatePreferences } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(null);
  const [rpcSettings, setRpcSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [settingsRes, rpcRes] = await Promise.all([
        settingsApi.getSettings(),
        settingsApi.getRpcSettings()
      ]);
      setSettings(settingsRes.data.data);
      setRpcSettings(rpcRes.data.data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (section, data) => {
    try {
      setSaving(true);
      await settingsApi.updateSettings({ [section]: data });
      toast.success('Settings saved');
      fetchSettings();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'rpc', label: 'RPC Endpoints', icon: Server },
    { id: 'trading', label: 'Trading', icon: TrendingUp },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-dark-400">Configure your preferences and connections</p>
        </div>
        <button onClick={fetchSettings} className="btn btn-secondary flex items-center gap-2">
          <RefreshCw size={16} />
          Refresh
        </button>
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
        {activeTab === 'general' && (
          <GeneralSettings 
            settings={settings} 
            onSave={handleSaveSettings}
            saving={saving}
          />
        )}
        {activeTab === 'rpc' && (
          <RpcSettings 
            rpcSettings={rpcSettings} 
            onRefresh={fetchSettings}
          />
        )}
        {activeTab === 'trading' && (
          <TradingSettings 
            settings={settings} 
            onSave={handleSaveSettings}
            saving={saving}
          />
        )}
        {activeTab === 'notifications' && (
          <NotificationSettings 
            user={user}
            onSave={updatePreferences}
          />
        )}
      </div>
    </div>
  );
};

// General Settings
const GeneralSettings = ({ settings, onSave, saving }) => {
  const [formData, setFormData] = useState({
    hotWalletTracker: settings?.hotWalletTracker || {},
    subwalletAnalyzer: settings?.subwalletAnalyzer || {},
    volumeBot: settings?.volumeBot || {},
  });

  const handleSave = () => {
    onSave('hotWalletTracker', formData.hotWalletTracker);
    onSave('subwalletAnalyzer', formData.subwalletAnalyzer);
    onSave('volumeBot', formData.volumeBot);
  };

  return (
    <div className="space-y-6">
      {/* Hot Wallet Tracker */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
            <Wallet className="text-primary-400" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Hot Wallet Tracker</h3>
            <p className="text-sm text-dark-400">Configure hot wallet monitoring</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Min Transfer Amount (SOL)</label>
            <input
              type="number"
              value={formData.hotWalletTracker.minTransferAmount || 0.1}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                hotWalletTracker: { ...prev.hotWalletTracker, minTransferAmount: parseFloat(e.target.value) }
              }))}
              step="0.1"
              className="input"
            />
          </div>
          <div>
            <label className="label">Max Wallets to Track</label>
            <input
              type="number"
              value={formData.hotWalletTracker.maxWalletsPerUser || 50}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                hotWalletTracker: { ...prev.hotWalletTracker, maxWalletsPerUser: parseInt(e.target.value) }
              }))}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Subwallet Analyzer */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-accent-purple/20 rounded-lg flex items-center justify-center">
            <Zap className="text-accent-purple" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Subwallet Analyzer</h3>
            <p className="text-sm text-dark-400">Configure subwallet detection</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Watch Duration (hours)</label>
            <input
              type="number"
              value={formData.subwalletAnalyzer.watchDurationHours || 24}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                subwalletAnalyzer: { ...prev.subwalletAnalyzer, watchDurationHours: parseInt(e.target.value) }
              }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Max Active Subwallets</label>
            <input
              type="number"
              value={formData.subwalletAnalyzer.maxActiveSubwallets || 100}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                subwalletAnalyzer: { ...prev.subwalletAnalyzer, maxActiveSubwallets: parseInt(e.target.value) }
              }))}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Volume Bot */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center">
            <Bot className="text-success" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Volume Bot</h3>
            <p className="text-sm text-dark-400">Configure volume generation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Enabled</label>
            <button
              onClick={() => setFormData(prev => ({
                ...prev,
                volumeBot: { ...prev.volumeBot, enabled: !prev.volumeBot.enabled }
              }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                formData.volumeBot.enabled
                  ? 'bg-success/20 text-success'
                  : 'bg-dark-700 text-dark-400'
              }`}
            >
              {formData.volumeBot.enabled ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {formData.volumeBot.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          <div>
            <label className="label">Max Deposit (SOL)</label>
            <input
              type="number"
              value={formData.volumeBot.maxDepositSol || 50}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                volumeBot: { ...prev.volumeBot, maxDepositSol: parseFloat(e.target.value) }
              }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Max Sessions Per User</label>
            <input
              type="number"
              value={formData.volumeBot.maxSessionsPerUser || 5}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                volumeBot: { ...prev.volumeBot, maxSessionsPerUser: parseInt(e.target.value) }
              }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Default Network</label>
            <select
              value={formData.volumeBot.defaultNetwork || 'devnet'}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                volumeBot: { ...prev.volumeBot, defaultNetwork: e.target.value }
              }))}
              className="input"
            >
              <option value="devnet">Devnet</option>
              <option value="mainnet-beta">Mainnet</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary flex items-center gap-2">
          {saving ? <div className="spinner w-4 h-4"></div> : <Save size={16} />}
          Save Changes
        </button>
      </div>
    </div>
  );
};

// RPC Settings
const RpcSettings = ({ rpcSettings, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [testing, setTesting] = useState(null);

  const handleAddEndpoint = async (endpoint) => {
    try {
      await settingsApi.addRpcEndpoint(endpoint);
      toast.success('Endpoint added');
      onRefresh();
      setShowAddModal(false);
    } catch (error) {
      toast.error('Failed to add endpoint');
    }
  };

  const handleRemoveEndpoint = async (id) => {
    if (!confirm('Remove this endpoint?')) return;
    try {
      await settingsApi.removeRpcEndpoint(id);
      toast.success('Endpoint removed');
      onRefresh();
    } catch (error) {
      toast.error('Failed to remove endpoint');
    }
  };

  const handleSetPrimary = async (id) => {
    try {
      await settingsApi.setPrimaryEndpoint(id);
      toast.success('Primary endpoint updated');
      onRefresh();
    } catch (error) {
      toast.error('Failed to set primary');
    }
  };

  const handleTestEndpoint = async (id) => {
    setTesting(id);
    try {
      const response = await settingsApi.testEndpoint(id);
      if (response.data.data.success) {
        toast.success(`Latency: ${response.data.data.latency}ms`);
      } else {
        toast.error('Endpoint test failed');
      }
    } catch (error) {
      toast.error('Test failed');
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Connection */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
              <Globe className="text-primary-400" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Current Connection</h3>
              <p className="text-sm text-dark-400">Active Solana RPC endpoint</p>
            </div>
          </div>
          <Badge variant={rpcSettings?.currentEndpoint ? 'success' : 'error'}>
            {rpcSettings?.currentEndpoint ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {rpcSettings?.currentEndpoint && (
          <div className="bg-dark-800 rounded-lg p-4">
            <p className="text-white font-medium">{rpcSettings.currentEndpoint.name}</p>
            <p className="text-sm text-dark-400 font-mono truncate">
              {rpcSettings.currentEndpoint.httpUrl}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-dark-500">
              <span>Network: {rpcSettings.currentEndpoint.network}</span>
              {rpcSettings.currentEndpoint.latency && (
                <span>Latency: {rpcSettings.currentEndpoint.latency}ms</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Endpoints List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">RPC Endpoints</h3>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm flex items-center gap-2"
          >
            <Plus size={14} />
            Add Endpoint
          </button>
        </div>

        {!rpcSettings?.endpoints || rpcSettings.endpoints.length === 0 ? (
          <div className="text-center py-8">
            <Server className="mx-auto text-dark-500 mb-2" size={32} />
            <p className="text-dark-400">No custom endpoints configured</p>
            <p className="text-dark-500 text-sm">Using default public RPC</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rpcSettings.endpoints.map((endpoint) => (
              <div key={endpoint._id} className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">{endpoint.name}</p>
                    {endpoint.isPrimary && (
                      <Badge variant="primary" size="sm">Primary</Badge>
                    )}
                  </div>
                  <p className="text-xs text-dark-400 font-mono truncate max-w-md">
                    {endpoint.httpUrl}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestEndpoint(endpoint._id)}
                    disabled={testing === endpoint._id}
                    className="btn btn-secondary btn-sm"
                  >
                    {testing === endpoint._id ? (
                      <div className="spinner w-3 h-3"></div>
                    ) : (
                      'Test'
                    )}
                  </button>
                  {!endpoint.isPrimary && (
                    <button
                      onClick={() => handleSetPrimary(endpoint._id)}
                      className="btn btn-secondary btn-sm"
                    >
                      Set Primary
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveEndpoint(endpoint._id)}
                    className="p-2 text-dark-400 hover:text-error"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Endpoint Modal */}
      {showAddModal && (
        <AddEndpointModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddEndpoint}
        />
      )}
    </div>
  );
};

// Add Endpoint Modal
const AddEndpointModal = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    httpUrl: '',
    wsUrl: '',
    network: 'mainnet-beta'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.httpUrl) {
      toast.error('Name and HTTP URL are required');
      return;
    }
    setLoading(true);
    await onAdd(formData);
    setLoading(false);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-content p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Add RPC Endpoint</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Chainstack Mainnet"
              className="input"
            />
          </div>
          <div>
            <label className="label">HTTP URL *</label>
            <input
              type="text"
              value={formData.httpUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, httpUrl: e.target.value }))}
              placeholder="https://..."
              className="input font-mono text-sm"
            />
          </div>
          <div>
            <label className="label">WebSocket URL (optional)</label>
            <input
              type="text"
              value={formData.wsUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, wsUrl: e.target.value }))}
              placeholder="wss://..."
              className="input font-mono text-sm"
            />
          </div>
          <div>
            <label className="label">Network</label>
            <select
              value={formData.network}
              onChange={(e) => setFormData(prev => ({ ...prev, network: e.target.value }))}
              className="input"
            >
              <option value="mainnet-beta">Mainnet</option>
              <option value="devnet">Devnet</option>
              <option value="testnet">Testnet</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Adding...' : 'Add Endpoint'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

// Trading Settings
const TradingSettings = ({ settings, onSave, saving }) => {
  const [formData, setFormData] = useState({
    defaultSlippageBps: settings?.trading?.defaultSlippageBps || 100,
    defaultPriorityFee: settings?.trading?.defaultPriorityFee || 10000,
    maxSolPerTrade: settings?.trading?.maxSolPerTrade || 10,
    preferredDex: settings?.trading?.preferredDex || 'jupiter',
  });

  const handleSave = () => {
    onSave('trading', formData);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
            <TrendingUp className="text-primary-400" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Trading Defaults</h3>
            <p className="text-sm text-dark-400">Default settings for all trades</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Default Slippage (bps)</label>
            <input
              type="number"
              value={formData.defaultSlippageBps}
              onChange={(e) => setFormData(prev => ({ ...prev, defaultSlippageBps: parseInt(e.target.value) }))}
              className="input"
            />
            <p className="text-xs text-dark-500 mt-1">100 bps = 1%</p>
          </div>
          <div>
            <label className="label">Default Priority Fee (lamports)</label>
            <input
              type="number"
              value={formData.defaultPriorityFee}
              onChange={(e) => setFormData(prev => ({ ...prev, defaultPriorityFee: parseInt(e.target.value) }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Max SOL Per Trade</label>
            <input
              type="number"
              value={formData.maxSolPerTrade}
              onChange={(e) => setFormData(prev => ({ ...prev, maxSolPerTrade: parseFloat(e.target.value) }))}
              step="0.1"
              className="input"
            />
          </div>
          <div>
            <label className="label">Preferred DEX</label>
            <select
              value={formData.preferredDex}
              onChange={(e) => setFormData(prev => ({ ...prev, preferredDex: e.target.value }))}
              className="input"
            >
              <option value="jupiter">Jupiter</option>
              <option value="raydium">Raydium</option>
              <option value="auto">Auto (Best Price)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary flex items-center gap-2">
          {saving ? <div className="spinner w-4 h-4"></div> : <Save size={16} />}
          Save Changes
        </button>
      </div>
    </div>
  );
};

// Notification Settings
const NotificationSettings = ({ user, onSave }) => {
  const [formData, setFormData] = useState({
    emailNotifications: user?.preferences?.emailNotifications ?? true,
    pushNotifications: user?.preferences?.pushNotifications ?? true,
    tradeAlerts: user?.preferences?.tradeAlerts ?? true,
    mintAlerts: user?.preferences?.mintAlerts ?? true,
    signalAlerts: user?.preferences?.signalAlerts ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  const toggleOptions = [
    { key: 'tradeAlerts', label: 'Trade Alerts', description: 'Notifications for completed trades' },
    { key: 'mintAlerts', label: 'Mint Alerts', description: 'Notifications for new token mints' },
    { key: 'signalAlerts', label: 'Signal Alerts', description: 'Notifications for trading signals' },
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
            <Bell className="text-primary-400" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Notification Preferences</h3>
            <p className="text-sm text-dark-400">Choose what notifications you receive</p>
          </div>
        </div>

        <div className="space-y-4">
          {toggleOptions.map((option) => (
            <div key={option.key} className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
              <div>
                <p className="text-white font-medium">{option.label}</p>
                <p className="text-sm text-dark-400">{option.description}</p>
              </div>
              <button
                onClick={() => setFormData(prev => ({ ...prev, [option.key]: !prev[option.key] }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData[option.key] ? 'bg-primary-600' : 'bg-dark-600'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  formData[option.key] ? 'left-7' : 'left-1'
                }`}></div>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary flex items-center gap-2">
          {saving ? <div className="spinner w-4 h-4"></div> : <Save size={16} />}
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default Settings;
