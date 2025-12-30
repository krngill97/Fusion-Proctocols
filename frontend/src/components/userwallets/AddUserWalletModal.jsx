import { useState } from 'react';
import { X, Users, AlertCircle } from 'lucide-react';
import { userWalletApi } from '../../services/api';

const AddUserWalletModal = ({ onClose, onAdded }) => {
  const [formData, setFormData] = useState({
    address: '',
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

    // Basic Solana address validation
    if (formData.address.length < 32 || formData.address.length > 44) {
      setError('Invalid Solana address');
      return;
    }

    try {
      setLoading(true);
      const response = await userWalletApi.add(formData);
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
              <Users className="text-primary-400" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Track Wallet</h2>
              <p className="text-sm text-dark-400">Add a wallet to receive trading signals</p>
            </div>
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
            <p className="text-xs text-dark-500 mt-1">
              The wallet you want to track for trading signals
            </p>
          </div>

          {/* Label */}
          <div>
            <label className="label">Label *</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
              placeholder="e.g., Alpha Trader, Whale Wallet"
              className="input"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any notes about this wallet..."
              className="input min-h-[80px] resize-none"
            />
          </div>

          {/* Info Box */}
          <div className="p-3 bg-primary-600/10 border border-primary-600/20 rounded-lg">
            <p className="text-sm text-primary-300">
              <strong>What you'll track:</strong>
            </p>
            <ul className="text-xs text-dark-400 mt-1 space-y-1">
              <li>• Token mints and pool creations</li>
              <li>• Buy and sell transactions</li>
              <li>• Large SOL transfers</li>
              <li>• Real-time notifications</li>
            </ul>
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

export default AddUserWalletModal;
