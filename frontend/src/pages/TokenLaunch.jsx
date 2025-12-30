/**
 * TokenLaunch.jsx - Real Solana Token Creation
 * Pump.fun style UI with large buttons and spacious design
 */

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Rocket, Image, DollarSign, Hash, FileText, Zap, ExternalLink, CheckCircle, AlertCircle, Copy, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const TokenLaunch = () => {
  const { publicKey, signMessage } = useWallet();
  const [loading, setLoading] = useState(false);
  const [createdToken, setCreatedToken] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    imageUrl: '',
    initialSupply: '1000000',
    decimals: '9',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateToken = async () => {
    if (!formData.name || !formData.symbol) {
      toast.error('Name and Symbol are required');
      return;
    }

    if (!publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    setLoading(true);

    try {
      // Use testnet simulator for now (instant and free)
      const response = await axios.post('/api/testnet/tokens', {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        imageUrl: formData.imageUrl,
        totalSupply: parseFloat(formData.initialSupply),
        decimals: parseInt(formData.decimals),
        creator: publicKey.toBase58(),
      });

      console.log('Response:', response);

      if (response.data && response.data.success) {
        const token = response.data.token; // Backend returns 'token' not 'data'
        setCreatedToken({
          name: token.name,
          symbol: token.symbol,
          mint: token.mint,
          initialSupply: token.totalSupply || token.supply,
          signature: 'SIMULATED_TX',
          solscanUrl: `http://localhost:5173/testnet/token/${token.mint}`,
          transactionUrl: `http://localhost:5173/testnet/token/${token.mint}`,
        });
        toast.success('Token created successfully!');
      } else {
        toast.error('Unexpected response from server');
        console.error('Invalid response:', response);
      }

    } catch (error) {
      console.error('Token creation error:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create token';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (createdToken) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        {/* Wallet Button - Top Right */}
        <div className="flex justify-end mb-8">
          <WalletMultiButton className="!h-12 !px-6 !rounded-lg !text-base !font-semibold !bg-primary-600 hover:!bg-primary-500" />
        </div>

        {/* Success Card */}
        <div className="bg-dark-900 border-2 border-success rounded-2xl p-10">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={48} className="text-success" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">
              Token Created Successfully!
            </h1>
            <p className="text-dark-400 text-lg">
              Your token is ready for testing and trading
            </p>
          </div>

          {/* Token Details */}
          <div className="space-y-6 mb-8">
            <div className="bg-dark-800 rounded-xl p-6">
              <p className="text-sm text-dark-500 mb-2">Token Name</p>
              <p className="text-2xl font-bold text-white">{createdToken.name} ({createdToken.symbol})</p>
            </div>

            <div className="bg-dark-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-dark-500">Mint Address</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdToken.mint);
                    toast.success('Copied to clipboard!');
                  }}
                  className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
              <p className="text-lg font-mono text-primary-400 break-all">{createdToken.mint}</p>
            </div>

            <div className="bg-dark-800 rounded-xl p-6">
              <p className="text-sm text-dark-500 mb-2">Initial Supply</p>
              <p className="text-xl font-semibold text-white">{createdToken.initialSupply.toLocaleString()} {createdToken.symbol}</p>
            </div>

            <div className="bg-dark-800 rounded-xl p-6">
              <p className="text-sm text-dark-500 mb-2">Transaction Signature</p>
              <p className="text-sm font-mono text-dark-300 break-all">{createdToken.signature}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href={createdToken.solscanUrl}
              className="h-14 bg-primary-600 hover:bg-primary-500 rounded-xl flex items-center justify-center gap-3 text-white font-semibold text-lg transition-colors"
            >
              <ExternalLink size={24} />
              View Token
            </a>

            <a
              href="/testnet-lab"
              className="h-14 bg-success hover:bg-success/90 rounded-xl flex items-center justify-center gap-3 text-white font-semibold text-lg transition-colors"
            >
              <TrendingUp size={24} />
              See All Tokens
            </a>

            <button
              onClick={() => setCreatedToken(null)}
              className="h-14 bg-dark-700 hover:bg-dark-600 rounded-xl text-white font-semibold text-lg transition-colors"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header with Wallet Button */}
      <div className="flex justify-between items-start mb-10">
        <div className="flex-1"></div>
        <div className="flex-1 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-accent-purple rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Rocket size={40} className="text-white" />
        </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Launch Your Token
          </h1>
          <p className="text-dark-400 text-xl">
            Create and test tokens instantly with our simulator
          </p>
        </div>
        <div className="flex-1 flex justify-end">
          <WalletMultiButton className="!h-12 !px-6 !rounded-lg !text-base !font-semibold !bg-primary-600 hover:!bg-primary-500" />
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-dark-900 rounded-2xl p-10 border border-dark-800">
        <div className="space-y-8">
          {/* Token Name */}
          <div>
            <label className="flex items-center gap-2 text-white font-semibold text-lg mb-4">
              <FileText size={24} className="text-primary-400" />
              Token Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="My Awesome Token"
              className="w-full h-14 bg-dark-800 border-2 border-dark-700 rounded-xl px-6 text-white text-lg placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Token Symbol */}
          <div>
            <label className="flex items-center gap-2 text-white font-semibold text-lg mb-4">
              <Hash size={24} className="text-primary-400" />
              Symbol
            </label>
            <input
              type="text"
              name="symbol"
              value={formData.symbol}
              onChange={handleChange}
              placeholder="MAT"
              className="w-full h-14 bg-dark-800 border-2 border-dark-700 rounded-xl px-6 text-white text-lg placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors uppercase"
            />
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-2 text-white font-semibold text-lg mb-4">
              <FileText size={24} className="text-primary-400" />
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe your token..."
              rows={4}
              className="w-full bg-dark-800 border-2 border-dark-700 rounded-xl px-6 py-4 text-white text-lg placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="flex items-center gap-2 text-white font-semibold text-lg mb-4">
              <Image size={24} className="text-primary-400" />
              Image URL
            </label>
            <input
              type="url"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="https://example.com/token-logo.png"
              className="w-full h-14 bg-dark-800 border-2 border-dark-700 rounded-xl px-6 text-white text-lg placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Initial Supply */}
          <div>
            <label className="flex items-center gap-2 text-white font-semibold text-lg mb-4">
              <DollarSign size={24} className="text-primary-400" />
              Initial Supply
            </label>
            <input
              type="number"
              name="initialSupply"
              value={formData.initialSupply}
              onChange={handleChange}
              placeholder="1000000"
              className="w-full h-14 bg-dark-800 border-2 border-dark-700 rounded-xl px-6 text-white text-lg placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Decimals */}
          <div>
            <label className="flex items-center gap-2 text-white font-semibold text-lg mb-4">
              <Hash size={24} className="text-primary-400" />
              Decimals
            </label>
            <input
              type="number"
              name="decimals"
              value={formData.decimals}
              onChange={handleChange}
              placeholder="9"
              min="0"
              max="9"
              className="w-full h-14 bg-dark-800 border-2 border-dark-700 rounded-xl px-6 text-white text-lg placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors"
            />
            <p className="text-dark-500 text-sm mt-2">Most tokens use 9 decimals (like SOL)</p>
          </div>

          {/* Info Box */}
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-6">
            <div className="flex gap-4">
              <AlertCircle size={24} className="text-primary-400 flex-shrink-0 mt-1" />
              <div>
                <p className="text-white font-semibold mb-2">Testnet Simulator Mode:</p>
                <ul className="text-dark-300 space-y-1 text-sm">
                  <li>• ✅ Instant token creation (no blockchain wait)</li>
                  <li>• ✅ Completely free (no SOL required)</li>
                  <li>• ✅ Perfect for testing trading & volume features</li>
                  <li>• ℹ️ Simulated tokens (not on real blockchain)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateToken}
            disabled={loading || !publicKey}
            className="w-full h-16 bg-gradient-to-r from-primary-600 to-accent-purple hover:from-primary-500 hover:to-accent-purple/90 disabled:from-dark-700 disabled:to-dark-700 disabled:cursor-not-allowed rounded-xl flex items-center justify-center gap-3 text-white font-bold text-xl transition-all shadow-lg shadow-primary-500/20"
          >
            {loading ? (
              <>
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating Token...
              </>
            ) : !publicKey ? (
              <>
                <Zap size={24} />
                Connect Wallet to Continue
              </>
            ) : (
              <>
                <Rocket size={24} />
                Launch Token Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Network Badge */}
      <div className="flex justify-center mt-8">
        <span className="inline-flex items-center gap-2 px-6 py-3 bg-info/20 border border-info/50 rounded-full text-info font-semibold">
          <Zap size={18} />
          Testnet Simulator (Instant & Free)
        </span>
      </div>
    </div>
  );
};

export default TokenLaunch;
