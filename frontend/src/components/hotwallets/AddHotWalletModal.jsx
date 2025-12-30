import { useState } from 'react';
import { X, Wallet, AlertCircle } from 'lucide-react';
import { hotWalletApi } from '../../services/api';

const EXCHANGES = [
  'Binance',
  'Coinbase',
  'Kraken',
  'OKX',
  'Bybit',
  'KuCoin',
  'Gate.io',
  'Bitget',
  'MEXC',
  'Huobi',
  'Other'
];

const AddHotWalletModal = ({ onClose, onAdded }) => {
  const [formData, setFormData] = useState({
    address: '',
    exchange: '',
    label: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.address) {
      setError('Wallet address is required');
      return;
    }

    if (!formData.exchange) {
      setError('Please select an exchange');
      return;
    }

    // Basic Solana address validation
    if (formData.address.length < 32 || formData.address.length > 44) {
      setError('Invalid Solana address');
      return;
    }

    try {
      setLoading(true);
      const response = await hotWalletApi.add(formData);
      onAdded(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to add wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="modal-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="modal-content p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
              <Wallet className="text-primary-400" size={20} />
            </div>
            <h2 className="text-xl font-semibold text-white">Add Hot Wallet</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Address */}
          <div>
            <label className="label">Wallet Address *</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Enter Solana wallet address"
              className="input font-mono"
              autoFocus
            />
          </div>

          {/* Exchange */}
          <div>
            <label className="label">Exchange *</label>
            <select
              value={formData.exchange}
              onChange={(e) => setFormData(prev => ({ ...prev, exchange: e.target.value }))}
              className="input"
            >
              <option value="">Select exchange</option>
              {EXCHANGES.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="label">Label (Optional)</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
              placeholder="e.g., Binance Hot Wallet 1"
              className="input"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional notes..."
              className="input min-h-[80px] resize-none"
            />
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
                  Adding...
                </span>
              ) : (
                'Add Wallet'
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AddHotWalletModal;
