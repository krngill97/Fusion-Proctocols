/**
 * RealTokenLaunch.jsx - REAL Solana SPL Token Creation
 * Creates actual tokens on Solana blockchain visible on Solscan
 */

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Rocket, ExternalLink, Loader, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import solanaService from '../services/solana.service';

const RealTokenLaunch = () => {
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [balance, setBalance] = useState(0);
  const [createdToken, setCreatedToken] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    imageUrl: '',
    initialSupply: '1000000',
    decimals: 9,
  });

  // Check balance when wallet connects
  useEffect(() => {
    if (wallet.publicKey) {
      checkBalance();
    }
  }, [wallet.publicKey]);

  const checkBalance = async () => {
    if (!wallet.publicKey) return;

    setCheckingBalance(true);
    try {
      const bal = await solanaService.getBalance(wallet.publicKey);
      setBalance(bal);
    } catch (error) {
      console.error('Balance check error:', error);
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleAirdrop = async () => {
    if (!wallet.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    setCheckingBalance(true);
    toast.loading('Requesting airdrop...', { id: 'airdrop' });

    try {
      const signature = await solanaService.requestAirdrop(wallet.publicKey, 2);
      toast.success('Airdrop successful! Check your balance', { id: 'airdrop' });

      // Wait a bit then check balance
      setTimeout(checkBalance, 2000);
    } catch (error) {
      console.error('Airdrop error:', error);
      toast.error(error.message || 'Airdrop failed', { id: 'airdrop' });
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleLaunch = async () => {
    if (!wallet.publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!formData.name || !formData.symbol) {
      toast.error('Name and Symbol are required');
      return;
    }

    if (balance < 0.01) {
      toast.error('You need at least 0.01 SOL. Request an airdrop first.');
      return;
    }

    setLoading(true);
    toast.loading('Creating token on blockchain...', { id: 'create' });

    try {
      const result = await solanaService.createToken({
        name: formData.name,
        symbol: formData.symbol,
        decimals: parseInt(formData.decimals),
        initialSupply: parseFloat(formData.initialSupply),
        wallet,
      });

      console.log('Token created:', result);

      setCreatedToken(result);
      toast.success('Token created successfully!', { id: 'create' });

      // Refresh balance
      setTimeout(checkBalance, 2000);

    } catch (error) {
      console.error('Token creation error:', error);
      toast.error(error.message || 'Failed to create token', { id: 'create' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCreatedToken(null);
    setFormData({
      name: '',
      symbol: '',
      description: '',
      imageUrl: '',
      initialSupply: '1000000',
      decimals: 9,
    });
  };

  return (
    <div className="min-h-screen bg-dark-950 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Real Token Launch</h1>
              <p className="text-dark-400 text-lg">Create actual SPL tokens on Solana devnet</p>
            </div>
            <WalletMultiButton className="!h-12 !px-6 !rounded-lg !bg-primary-600 hover:!bg-primary-500" />
          </div>

          <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-primary-600/20 to-accent-purple/20 rounded-full mb-6">
            <Rocket className="text-primary-400" size={24} />
            <span className="text-lg font-bold text-white">Launch Real SPL Token</span>
          </div>
          <p className="text-dark-400 text-lg mb-4">
            Create actual tokens on Solana devnet blockchain
          </p>
          <div className="flex items-center justify-center gap-4">
            <span className="px-4 py-2 bg-success-900/20 border border-success-700 rounded-lg text-success-400 text-sm font-medium">
              ✅ Real Blockchain
            </span>
            <span className="px-4 py-2 bg-primary-900/20 border border-primary-700 rounded-lg text-primary-400 text-sm font-medium">
              ✅ Visible on Solscan
            </span>
            <span className="px-4 py-2 bg-accent-purple/20 border border-accent-purple rounded-lg text-accent-purple text-sm font-medium">
              ✅ Free on Devnet
            </span>
          </div>
        </div>

        {/* Content */}
        {!wallet.connected ? (
          <div className="bg-dark-900 rounded-2xl p-12 border border-dark-800 text-center">
            <div className="w-20 h-20 bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Rocket size={40} className="text-primary-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Connect Your Wallet</h3>
            <p className="text-dark-400 mb-8 max-w-md mx-auto">
              Connect your Phantom wallet to create real SPL tokens on Solana devnet
            </p>
            <WalletMultiButton className="!h-14 !px-8 !bg-gradient-to-r !from-primary-600 !to-accent-purple hover:!from-primary-500 hover:!to-accent-purple !rounded-xl !text-base !font-semibold !shadow-lg !shadow-primary-500/20" />
          </div>
        ) : !createdToken ? (
          <div className="space-y-6">
            {/* Balance Display */}
            <div className="bg-dark-900 rounded-xl p-6 border border-dark-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dark-400 mb-1">Your Devnet Balance</p>
                  <p className="text-2xl font-bold text-white">
                    {checkingBalance ? (
                      <span className="flex items-center gap-2">
                        <Loader size={20} className="animate-spin" />
                        Checking...
                      </span>
                    ) : (
                      `${balance.toFixed(4)} SOL`
                    )}
                  </p>
                </div>
                <button
                  onClick={handleAirdrop}
                  disabled={checkingBalance}
                  className="h-12 px-6 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  Request 2 SOL
                </button>
              </div>
              {balance < 0.01 && (
                <div className="mt-4 p-4 bg-warning-900/20 border border-warning-700 rounded-lg">
                  <p className="text-warning-400 text-sm">
                    ⚠️ You need at least 0.01 SOL to create a token. Request an airdrop above.
                  </p>
                </div>
              )}
            </div>

            {/* Token Form */}
            <div className="bg-dark-900 rounded-2xl p-10 border border-dark-800">
              <h3 className="text-white font-semibold text-xl mb-8">Token Details</h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-3">
                    Token Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Awesome Token"
                    className="w-full h-14 px-6 bg-dark-800 border border-dark-700 rounded-xl text-white text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-3">
                    Symbol *
                  </label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    placeholder="TOKEN"
                    maxLength={10}
                    className="w-full h-14 px-6 bg-dark-800 border border-dark-700 rounded-xl text-white text-lg uppercase focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-3">
                    Initial Supply *
                  </label>
                  <input
                    type="number"
                    value={formData.initialSupply}
                    onChange={(e) => setFormData({ ...formData, initialSupply: e.target.value })}
                    placeholder="1000000"
                    className="w-full h-14 px-6 bg-dark-800 border border-dark-700 rounded-xl text-white text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                  <p className="text-xs text-dark-500 mt-2">
                    {parseInt(formData.initialSupply || 0).toLocaleString()} tokens will be minted to your wallet
                  </p>
                </div>
              </div>

              <button
                onClick={handleLaunch}
                disabled={loading || balance < 0.01}
                className="w-full h-16 mt-8 bg-gradient-to-r from-primary-600 to-accent-purple hover:from-primary-500 hover:to-accent-purple text-white text-lg font-bold rounded-xl shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <Loader size={20} className="animate-spin" />
                    Creating on Blockchain...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    <Rocket size={20} />
                    Create Real Token on Devnet
                  </span>
                )}
              </button>

              <div className="mt-6 p-4 bg-primary-900/10 border border-primary-700/30 rounded-xl">
                <p className="text-xs text-dark-400 leading-relaxed">
                  ✅ Creates REAL SPL token on Solana devnet<br />
                  ✅ Visible on Solscan immediately<br />
                  ✅ Your wallet holds mint authority<br />
                  ✅ Tokens minted to your wallet<br />
                  ✅ Free on devnet (just pay gas)
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Success State */
          <div className="bg-gradient-to-br from-success-900/20 to-primary-900/20 rounded-2xl p-12 border border-success-500/20">
            <div className="text-center">
              <div className="w-24 h-24 bg-success-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                <Rocket size={48} className="text-success-400" />
              </div>

              <h2 className="text-3xl font-bold text-white mb-3">Token Created!</h2>
              <p className="text-dark-400 text-lg mb-10">
                Your SPL token is now live on Solana devnet blockchain
              </p>

              <div className="bg-dark-900/50 rounded-xl p-8 mb-10 text-left">
                <div className="space-y-6">
                  <div>
                    <label className="text-xs text-dark-500 uppercase tracking-wide font-semibold">
                      Token Mint Address
                    </label>
                    <div className="mt-2 p-4 bg-dark-800 rounded-lg">
                      <p className="text-white font-mono text-sm break-all">
                        {createdToken.mint}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-dark-500 uppercase tracking-wide font-semibold">
                      Transaction Signature
                    </label>
                    <div className="mt-2 p-4 bg-dark-800 rounded-lg">
                      <p className="text-white font-mono text-sm break-all">
                        {createdToken.signature}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-dark-500 uppercase tracking-wide font-semibold">
                        Symbol
                      </label>
                      <p className="text-white text-lg font-bold mt-1">
                        {createdToken.symbol}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-dark-500 uppercase tracking-wide font-semibold">
                        Initial Supply
                      </label>
                      <p className="text-white text-lg font-bold mt-1">
                        {parseInt(createdToken.initialSupply).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <a
                  href={createdToken.solscanTokenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-16 bg-primary-600 hover:bg-primary-500 text-white rounded-xl flex items-center justify-center gap-3 font-semibold text-lg transition-colors"
                >
                  <ExternalLink size={20} />
                  View Token on Solscan
                </a>
                <a
                  href={createdToken.solscanTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-16 bg-dark-800 hover:bg-dark-700 text-white rounded-xl flex items-center justify-center gap-3 font-semibold text-lg transition-colors border border-dark-700"
                >
                  <ExternalLink size={20} />
                  View Transaction
                </a>
              </div>

              <button
                onClick={resetForm}
                className="w-full h-14 mt-6 bg-dark-800 hover:bg-dark-700 text-white rounded-xl font-semibold transition-colors"
              >
                Create Another Token
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTokenLaunch;
