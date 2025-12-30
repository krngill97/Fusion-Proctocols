import { useState } from 'react';
import { X, Bot, AlertCircle, Info } from 'lucide-react';
import { volumeApi } from '../../services/api';
import toast from 'react-hot-toast';

const CreateSessionModal = ({ onClose, onCreated, maxDeposit }) => {
  const [formData, setFormData] = useState({
    tokenMint: '',
    depositAmount: '0.5',
    config: {
      minTradeAmount: '0.001',
      maxTradeAmount: '0.01',
      tradeIntervalMin: '5000',
      tradeIntervalMax: '15000',
      buySellRatio: '0.5',
      useRandomAmounts: true,
      useRandomTiming: true,
      makerWalletCount: '5',
      maxDuration: '3600000', // 1 hour
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.tokenMint) {
      setError('Token address is required');
      return;
    }

    const depositAmount = parseFloat(formData.depositAmount);
    if (isNaN(depositAmount) || depositAmount < 0.1) {
      setError('Minimum deposit is 0.1 SOL');
      return;
    }

    if (depositAmount > maxDeposit) {
      setError(`Maximum deposit is ${maxDeposit} SOL`);
      return;
    }

    try {
      setLoading(true);
      
      const config = {
        minTradeAmount: parseFloat(formData.config.minTradeAmount),
        maxTradeAmount: parseFloat(formData.config.maxTradeAmount),
        tradeIntervalMin: parseInt(formData.config.tradeIntervalMin),
        tradeIntervalMax: parseInt(formData.config.tradeIntervalMax),
        buySellRatio: parseFloat(formData.config.buySellRatio),
        useRandomAmounts: formData.config.useRandomAmounts,
        useRandomTiming: formData.config.useRandomTiming,
        makerWalletCount: parseInt(formData.config.makerWalletCount),
        maxDuration: parseInt(formData.config.maxDuration),
      };

      const response = await volumeApi.createSession({
        tokenMint: formData.tokenMint,
        depositAmount,
        config
      });
      
      onCreated(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="modal-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="modal-content max-w-xl">
        {/* Header */}
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-purple/20 rounded-lg flex items-center justify-center">
                <Bot className="text-accent-purple" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Create Volume Session</h2>
                <p className="text-sm text-dark-400">Generate trading volume for your token</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-dark-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Token Address */}
          <div>
            <label className="label">Token Address *</label>
            <input
              type="text"
              value={formData.tokenMint}
              onChange={(e) => setFormData(prev => ({ ...prev, tokenMint: e.target.value }))}
              placeholder="Enter token mint address"
              className="input font-mono text-sm"
            />
          </div>

          {/* Deposit Amount */}
          <div>
            <label className="label">Deposit Amount (SOL) *</label>
            <input
              type="number"
              value={formData.depositAmount}
              onChange={(e) => setFormData(prev => ({ ...prev, depositAmount: e.target.value }))}
              placeholder="0.5"
              min="0.1"
              max={maxDeposit}
              step="0.1"
              className="input"
            />
            <p className="text-xs text-dark-500 mt-1">
              Min: 0.1 SOL • Max: {maxDeposit} SOL
            </p>
          </div>

          {/* Quick Settings */}
          <div>
            <label className="label">Maker Wallets</label>
            <div className="flex gap-2">
              {['3', '5', '10', '15'].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, makerWalletCount: val }
                  }))}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    formData.config.makerWalletCount === val
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-800 text-dark-400 hover:text-white'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="label">Session Duration</label>
            <select
              value={formData.config.maxDuration}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                config: { ...prev.config, maxDuration: e.target.value }
              }))}
              className="input"
            >
              <option value="1800000">30 minutes</option>
              <option value="3600000">1 hour</option>
              <option value="7200000">2 hours</option>
              <option value="14400000">4 hours</option>
              <option value="28800000">8 hours</option>
            </select>
          </div>

          {/* Advanced Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
          </button>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-dark-800 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Min Trade (SOL)</label>
                  <input
                    type="number"
                    value={formData.config.minTradeAmount}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, minTradeAmount: e.target.value }
                    }))}
                    step="0.001"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Max Trade (SOL)</label>
                  <input
                    type="number"
                    value={formData.config.maxTradeAmount}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, maxTradeAmount: e.target.value }
                    }))}
                    step="0.001"
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Min Interval (ms)</label>
                  <input
                    type="number"
                    value={formData.config.tradeIntervalMin}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, tradeIntervalMin: e.target.value }
                    }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Max Interval (ms)</label>
                  <input
                    type="number"
                    value={formData.config.tradeIntervalMax}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, maxTradeInterval: e.target.value }
                    }))}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Buy/Sell Ratio (0-1)</label>
                <input
                  type="number"
                  value={formData.config.buySellRatio}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, buySellRatio: e.target.value }
                  }))}
                  min="0"
                  max="1"
                  step="0.1"
                  className="input"
                />
                <p className="text-xs text-dark-500 mt-1">
                  0.5 = equal buys/sells, 0.7 = more buys
                </p>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.config.useRandomAmounts}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, useRandomAmounts: e.target.checked }
                    }))}
                    className="w-4 h-4 rounded bg-dark-700 border-dark-600"
                  />
                  <span className="text-sm text-dark-300">Random amounts</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.config.useRandomTiming}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, useRandomTiming: e.target.checked }
                    }))}
                    className="w-4 h-4 rounded bg-dark-700 border-dark-600"
                  />
                  <span className="text-sm text-dark-300">Random timing</span>
                </label>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="flex items-start gap-3 p-3 bg-info/10 border border-info/20 rounded-lg">
            <Info className="text-info flex-shrink-0 mt-0.5" size={16} />
            <div className="text-sm text-dark-400">
              <p>The deposit will be distributed across maker wallets.</p>
              <p className="mt-1">Remaining funds are returned when the session ends.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="spinner w-4 h-4"></div>
                  Creating...
                </span>
              ) : (
                'Create Session'
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default CreateSessionModal;
