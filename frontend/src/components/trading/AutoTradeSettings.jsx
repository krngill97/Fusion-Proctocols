import { useState, useEffect } from 'react';
import { 
  Zap, 
  Copy, 
  Target, 
  Shield, 
  Droplets,
  ToggleLeft,
  ToggleRight,
  Save,
  AlertCircle
} from 'lucide-react';
import { tradingApi } from '../../services/api';
import toast from 'react-hot-toast';

const AutoTradeSettings = ({ status, onUpdate }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await tradingApi.getAutoSettings();
      setSettings(response.data.data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async () => {
    try {
      if (settings?.enabled) {
        await tradingApi.disableAuto();
        toast.success('Auto-trading disabled');
      } else {
        await tradingApi.enableAuto();
        toast.success('Auto-trading enabled');
      }
      fetchSettings();
      onUpdate?.();
    } catch (error) {
      toast.error('Failed to toggle auto-trading');
    }
  };

  const handleSaveSettings = async (section, data) => {
    try {
      setSaving(true);
      await tradingApi.updateAutoSettings({ [section]: data });
      toast.success('Settings saved');
      fetchSettings();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="text-accent-purple" size={20} />
              Auto-Trading
            </h3>
            <p className="text-dark-400 text-sm mt-1">
              Automatically execute trades based on your strategies
            </p>
          </div>
          <button
            onClick={handleToggleEnabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              settings?.enabled
                ? 'bg-success/20 text-success'
                : 'bg-dark-700 text-dark-400'
            }`}
          >
            {settings?.enabled ? (
              <>
                <ToggleRight size={20} />
                Enabled
              </>
            ) : (
              <>
                <ToggleLeft size={20} />
                Disabled
              </>
            )}
          </button>
        </div>
      </div>

      {/* Copy Trading */}
      <SettingSection
        title="Copy Trading"
        description="Copy trades from wallets you track"
        icon={Copy}
        enabled={settings?.copyTrading?.enabled}
        settings={settings?.copyTrading}
        onSave={(data) => handleSaveSettings('copyTrading', data)}
        fields={[
          { key: 'fixedAmount', label: 'Fixed Amount (SOL)', type: 'number', placeholder: '0.1' },
          { key: 'percentageOfTrade', label: 'Percentage of Trade', type: 'number', placeholder: '50' },
          { key: 'maxAmountPerTrade', label: 'Max Amount Per Trade (SOL)', type: 'number', placeholder: '1' },
          { key: 'copySells', label: 'Copy Sells', type: 'toggle' },
          { key: 'slippageBps', label: 'Slippage (bps)', type: 'number', placeholder: '100' },
          { key: 'cooldownSeconds', label: 'Cooldown (seconds)', type: 'number', placeholder: '60' },
        ]}
      />

      {/* Snipe Mints */}
      <SettingSection
        title="Snipe New Mints"
        description="Auto-buy newly minted tokens"
        icon={Zap}
        enabled={settings?.snipeMints?.enabled}
        settings={settings?.snipeMints}
        onSave={(data) => handleSaveSettings('snipeMints', data)}
        fields={[
          { key: 'amount', label: 'Buy Amount (SOL)', type: 'number', placeholder: '0.1' },
          { key: 'slippageBps', label: 'Slippage (bps)', type: 'number', placeholder: '500' },
          { key: 'priorityFee', label: 'Priority Fee (lamports)', type: 'number', placeholder: '50000' },
          { key: 'cooldownSeconds', label: 'Cooldown (seconds)', type: 'number', placeholder: '60' },
        ]}
      />

      {/* Snipe Pools */}
      <SettingSection
        title="Snipe New Pools"
        description="Auto-buy when liquidity pools are created"
        icon={Droplets}
        enabled={settings?.snipePools?.enabled}
        settings={settings?.snipePools}
        onSave={(data) => handleSaveSettings('snipePools', data)}
        fields={[
          { key: 'amount', label: 'Buy Amount (SOL)', type: 'number', placeholder: '0.1' },
          { key: 'slippageBps', label: 'Slippage (bps)', type: 'number', placeholder: '500' },
          { key: 'priorityFee', label: 'Priority Fee (lamports)', type: 'number', placeholder: '50000' },
          { key: 'cooldownSeconds', label: 'Cooldown (seconds)', type: 'number', placeholder: '60' },
        ]}
      />

      {/* Take Profit */}
      <SettingSection
        title="Take Profit"
        description="Automatically sell when profit target is reached"
        icon={Target}
        enabled={settings?.takeProfit?.enabled}
        settings={settings?.takeProfit}
        onSave={(data) => handleSaveSettings('takeProfit', data)}
        fields={[
          { key: 'targetPercent', label: 'Target Profit (%)', type: 'number', placeholder: '100' },
          { key: 'sellPercent', label: 'Sell Percentage (%)', type: 'number', placeholder: '50' },
        ]}
      />

      {/* Stop Loss */}
      <SettingSection
        title="Stop Loss"
        description="Automatically sell when loss threshold is reached"
        icon={Shield}
        enabled={settings?.stopLoss?.enabled}
        settings={settings?.stopLoss}
        onSave={(data) => handleSaveSettings('stopLoss', data)}
        fields={[
          { key: 'stopPercent', label: 'Stop Loss (%)', type: 'number', placeholder: '20' },
          { key: 'sellPercent', label: 'Sell Percentage (%)', type: 'number', placeholder: '100' },
        ]}
      />

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-lg">
        <AlertCircle className="text-warning flex-shrink-0" size={20} />
        <div className="text-sm">
          <p className="text-warning font-medium">Use with caution</p>
          <p className="text-dark-400 mt-1">
            Auto-trading involves risk. Start with small amounts and monitor your strategies closely.
            Make sure you have sufficient SOL balance and understand the risks involved.
          </p>
        </div>
      </div>
    </div>
  );
};

// Setting Section Component
const SettingSection = ({ title, description, icon: Icon, enabled, settings, onSave, fields }) => {
  const [formData, setFormData] = useState(settings || {});
  const [isEnabled, setIsEnabled] = useState(enabled || false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setFormData(settings || {});
    setIsEnabled(enabled || false);
  }, [settings, enabled]);

  const handleSave = () => {
    onSave({ ...formData, enabled: isEnabled });
  };

  return (
    <div className="card">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
            <Icon className="text-primary-400" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-dark-400 text-sm">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEnabled(!isEnabled);
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
              isEnabled
                ? 'bg-success/20 text-success'
                : 'bg-dark-700 text-dark-400'
            }`}
          >
            {isEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {isEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-dark-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="label">{field.label}</label>
                {field.type === 'toggle' ? (
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      formData[field.key]
                        ? 'bg-success/20 text-success'
                        : 'bg-dark-700 text-dark-400'
                    }`}
                  >
                    {formData[field.key] ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    {formData[field.key] ? 'Yes' : 'No'}
                  </button>
                ) : (
                  <input
                    type={field.type}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      [field.key]: field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value 
                    }))}
                    placeholder={field.placeholder}
                    className="input"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleSave} className="btn btn-primary flex items-center gap-2">
              <Save size={16} />
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoTradeSettings;
