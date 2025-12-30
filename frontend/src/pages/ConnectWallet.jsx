/**
 * ConnectWallet.jsx - Simple connect page
 */

import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Zap, Shield, TrendingUp, Bot, Wallet } from 'lucide-react';

const ConnectWallet = () => {
  const navigate = useNavigate();
  const { connected } = useWallet();

  // If already connected, show a button to go to dashboard
  // Don't auto-redirect to avoid loops

  const features = [
    { icon: TrendingUp, title: 'Smart Trading', desc: 'Execute trades via Jupiter & Raydium' },
    { icon: Zap, title: 'Real-Time Tracking', desc: 'Monitor wallets with WebSocket updates' },
    { icon: Bot, title: 'Volume Generation', desc: 'Organic volume with maker wallets' },
    { icon: Shield, title: 'Secure Auth', desc: 'Sign-in with Solana wallet' },
  ];

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-dark-900 border-r border-dark-800 flex-col justify-between p-8">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary-500 to-accent-purple flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">FUSION</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Professional Solana
            <br />
            <span className="text-gradient">Trading Platform</span>
          </h1>
          <p className="text-dark-400 text-sm max-w-md mb-8">
            Track wallets, execute trades, and generate volume with institutional-grade tools.
          </p>

          <div className="space-y-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded bg-dark-800 flex items-center justify-center flex-shrink-0">
                  <feature.icon size={16} className="text-primary-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{feature.title}</p>
                  <p className="text-xs text-dark-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-dark-600">
          Powered by Solana - Built for traders
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary-500 to-accent-purple flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">FUSION</span>
          </div>

          {/* Connect Card */}
          <div className="card p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-lg bg-dark-800 flex items-center justify-center mx-auto mb-4">
                <Wallet size={24} className="text-primary-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">
                {connected ? 'Wallet Connected!' : 'Connect Wallet'}
              </h2>
              <p className="text-xs text-dark-400">
                {connected ? 'You can now access the dashboard' : 'Connect your wallet to explore'}
              </p>
            </div>

            {/* Wallet Button */}
            <div className="wallet-adapter-wrapper mb-4">
              <WalletMultiButton className="!w-full !h-10 !bg-primary-600 hover:!bg-primary-500 !rounded !text-sm !font-medium !transition-colors" />
            </div>

            {/* Go to Dashboard Button */}
            <button
              onClick={() => navigate('/')}
              className={`w-full h-10 rounded text-sm font-medium transition-colors mb-4 ${
                connected
                  ? 'bg-success hover:bg-success/90 text-white'
                  : 'bg-dark-800 hover:bg-dark-700 text-dark-300'
              }`}
            >
              {connected ? 'Go to Dashboard' : 'Skip for now'}
            </button>

            {/* Supported Wallets */}
            <div className="pt-4 border-t border-dark-800">
              <p className="text-2xs text-dark-500 text-center mb-3">Supported wallets</p>
              <div className="flex justify-center gap-4">
                <WalletIcon name="Phantom" />
                <WalletIcon name="Solflare" />
                <WalletIcon name="Backpack" />
              </div>
            </div>
          </div>

          {/* Network Notice */}
          <div className="mt-4 text-center">
            <span className="badge badge-warning">Demo Mode</span>
            <p className="text-2xs text-dark-600 mt-2">
              Running in demo mode - all features accessible
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const WalletIcon = ({ name }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="w-8 h-8 rounded bg-dark-800 flex items-center justify-center">
      <span className="text-xs font-bold text-dark-400">{name[0]}</span>
    </div>
    <span className="text-2xs text-dark-600">{name}</span>
  </div>
);

export default ConnectWallet;
