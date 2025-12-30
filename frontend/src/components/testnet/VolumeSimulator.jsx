import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Activity, Play, Square, Pause, RotateCcw,
  TrendingUp, Users, DollarSign, Clock, Zap
} from 'lucide-react';
import { Button, Card, Input, Spinner, Badge } from '../common';
import { testnetVolumeApi } from '../../services/api';
import toast from 'react-hot-toast';

const VolumeSimulator = ({ tokenMint, tokenSymbol, onSessionUpdate }) => {
  const { publicKey } = useWallet();

  // Session config
  const [config, setConfig] = useState({
    budget: 1,
    duration: 30,
    tradeInterval: 5,
    minTradeSize: 0.01,
    maxTradeSize: 0.05,
    walletCount: 20,
    buyRatio: 0.7
  });

  // Session state
  const [activeSession, setActiveSession] = useState(null);
  const [sessionResults, setSessionResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  // Poll active session
  useEffect(() => {
    let interval;
    if (activeSession && activeSession.status === 'running') {
      setPolling(true);
      interval = setInterval(pollSession, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
      setPolling(false);
    };
  }, [activeSession?._id, activeSession?.status]);

  const pollSession = async () => {
    if (!activeSession?._id) return;

    try {
      const res = await testnetVolumeApi.getSession(activeSession._id);
      const session = res.data.session;
      setActiveSession(session);

      if (session.status === 'completed' || session.status === 'stopped' || session.status === 'failed') {
        setSessionResults(session.metrics);
        toast.success('Volume simulation complete!');
        if (onSessionUpdate) onSessionUpdate(session);
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
  };

  const startSimulation = async () => {
    if (!publicKey) {
      toast.error('Connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      toast.loading('Starting volume simulation...', { id: 'sim' });

      const res = await testnetVolumeApi.startSession({
        tokenMint,
        creator: publicKey.toBase58(),
        config
      });

      setActiveSession(res.data.session);
      setSessionResults(null);
      toast.success('Simulation started!', { id: 'sim' });

    } catch (error) {
      console.error('Start error:', error);
      toast.error(error.response?.data?.message || 'Failed to start simulation', { id: 'sim' });
    } finally {
      setLoading(false);
    }
  };

  const stopSimulation = async () => {
    if (!activeSession?._id) return;

    try {
      setLoading(true);
      await testnetVolumeApi.stopSession(activeSession._id, publicKey.toBase58());
      toast.success('Simulation stopped');
    } catch (error) {
      console.error('Stop error:', error);
      toast.error('Failed to stop simulation');
    } finally {
      setLoading(false);
    }
  };

  const pauseSimulation = async () => {
    if (!activeSession?._id) return;

    try {
      const res = await testnetVolumeApi.pauseSession(activeSession._id, publicKey.toBase58());
      setActiveSession(res.data.session);
      toast.success('Simulation paused');
    } catch (error) {
      console.error('Pause error:', error);
      toast.error('Failed to pause simulation');
    }
  };

  const resumeSimulation = async () => {
    if (!activeSession?._id) return;

    try {
      const res = await testnetVolumeApi.resumeSession(activeSession._id, publicKey.toBase58());
      setActiveSession(res.data.session);
      toast.success('Simulation resumed');
    } catch (error) {
      console.error('Resume error:', error);
      toast.error('Failed to resume simulation');
    }
  };

  const resetSimulator = () => {
    setActiveSession(null);
    setSessionResults(null);
  };

  const isRunning = activeSession?.status === 'running';
  const isPaused = activeSession?.status === 'paused';
  const isComplete = ['completed', 'stopped', 'failed'].includes(activeSession?.status);

  // Calculate estimated performance
  const estimatedTrades = Math.floor((config.duration * 60) / config.tradeInterval);
  const estimatedVolume = config.budget * 5; // Rough estimate

  return (
    <div className="space-y-4">
      {/* Configuration */}
      {!activeSession && !sessionResults && (
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="text-primary-400" />
            Volume Bot Configuration
          </h3>

          <div className="space-y-4">
            {/* Budget & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">
                  Budget (SOL)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={config.budget}
                  onChange={(e) => setConfig({ ...config, budget: parseFloat(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded text-white text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={config.duration}
                  onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded text-white text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            {/* Trade Size */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">
                  Min Trade Size (SOL)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={config.minTradeSize}
                  onChange={(e) => setConfig({ ...config, minTradeSize: parseFloat(e.target.value) || 0.01 })}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded text-white text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">
                  Max Trade Size (SOL)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="0.5"
                  value={config.maxTradeSize}
                  onChange={(e) => setConfig({ ...config, maxTradeSize: parseFloat(e.target.value) || 0.05 })}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded text-white text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            {/* Interval & Wallets */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">
                  Trade Interval (seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.tradeInterval}
                  onChange={(e) => setConfig({ ...config, tradeInterval: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded text-white text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">
                  Wallet Count
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={config.walletCount}
                  onChange={(e) => setConfig({ ...config, walletCount: parseInt(e.target.value) || 20 })}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded text-white text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            {/* Buy Ratio */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">
                Buy Ratio: {(config.buyRatio * 100).toFixed(0)}% buys / {((1 - config.buyRatio) * 100).toFixed(0)}% sells
              </label>
              <input
                type="range"
                min="0.5"
                max="0.9"
                step="0.05"
                value={config.buyRatio}
                onChange={(e) => setConfig({ ...config, buyRatio: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Estimated Performance */}
            <div className="bg-primary-900/20 border border-primary-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-primary-400 mb-2 flex items-center gap-2">
                <Zap size={14} />
                Estimated Performance
              </h4>
              <div className="grid grid-cols-3 gap-2 text-xs text-dark-300">
                <div>
                  <span className="text-dark-500">Est. Trades:</span>
                  <span className="ml-1 text-white">~{estimatedTrades}</span>
                </div>
                <div>
                  <span className="text-dark-500">Est. Volume:</span>
                  <span className="ml-1 text-white">~{estimatedVolume.toFixed(1)} SOL</span>
                </div>
                <div>
                  <span className="text-dark-500">Holders:</span>
                  <span className="ml-1 text-white">{config.walletCount}</span>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <Button
              onClick={startSimulation}
              disabled={loading || !publicKey}
              className="w-full h-12"
            >
              {loading ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Play size={18} />
                  Start Simulation
                </>
              )}
            </Button>

            {!publicKey && (
              <p className="text-xs text-dark-500 text-center">
                Connect your wallet to start simulation
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Active Session */}
      {activeSession && !isComplete && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              {isRunning && <div className="w-2 h-2 rounded-full bg-success-400 animate-pulse" />}
              {isPaused && <div className="w-2 h-2 rounded-full bg-warning-400" />}
              {isRunning ? 'Simulation Running' : 'Simulation Paused'}
            </h3>
            <div className="flex gap-2">
              {isRunning && (
                <Button size="sm" variant="warning" onClick={pauseSimulation}>
                  <Pause size={14} />
                </Button>
              )}
              {isPaused && (
                <Button size="sm" variant="success" onClick={resumeSimulation}>
                  <Play size={14} />
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={stopSimulation} disabled={loading}>
                <Square size={14} />
              </Button>
            </div>
          </div>

          {/* Live Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-dark-900 rounded-lg p-3">
              <div className="flex items-center gap-2 text-dark-400 text-xs mb-1">
                <DollarSign size={12} />
                <span>Volume</span>
              </div>
              <p className="text-lg font-bold text-white">
                {activeSession.metrics?.totalVolume?.toFixed(3) || '0.000'} SOL
              </p>
            </div>

            <div className="bg-dark-900 rounded-lg p-3">
              <div className="flex items-center gap-2 text-dark-400 text-xs mb-1">
                <Activity size={12} />
                <span>Trades</span>
              </div>
              <p className="text-lg font-bold text-white">
                {activeSession.metrics?.totalTrades || 0}
              </p>
            </div>

            <div className="bg-dark-900 rounded-lg p-3">
              <div className="flex items-center gap-2 text-dark-400 text-xs mb-1">
                <Users size={12} />
                <span>Wallets</span>
              </div>
              <p className="text-lg font-bold text-white">
                {activeSession.generatedWallets?.length || 0}
              </p>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-dark-400 mb-2">
              <span>Progress</span>
              <span>
                {activeSession.metrics?.totalTrades || 0} / ~{estimatedTrades} trades
              </span>
            </div>
            <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-success-500 to-primary-500 transition-all duration-500"
                style={{
                  width: `${Math.min(100, ((activeSession.metrics?.totalTrades || 0) / estimatedTrades) * 100)}%`
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {sessionResults && isComplete && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Simulation Results</h3>
            <Badge variant={activeSession.status === 'completed' ? 'success' : 'warning'}>
              {activeSession.status}
            </Badge>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-xs text-dark-400 mb-1">Total Volume</p>
              <p className="text-lg font-bold text-white">
                {sessionResults.totalVolume?.toFixed(3)} SOL
              </p>
              <p className="text-xs text-success-400">
                {sessionResults.volumeMultiplier?.toFixed(1)}x budget
              </p>
            </div>

            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-xs text-dark-400 mb-1">Total Trades</p>
              <p className="text-lg font-bold text-white">
                {sessionResults.totalTrades}
              </p>
              <p className="text-xs text-dark-500">
                {sessionResults.buyTrades} buys / {sessionResults.sellTrades} sells
              </p>
            </div>

            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-xs text-dark-400 mb-1">Unique Holders</p>
              <p className="text-lg font-bold text-white">
                {sessionResults.uniqueHolders || 0}
              </p>
              <p className="text-xs text-dark-500">
                {sessionResults.activeHolders || 0} still holding
              </p>
            </div>

            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-xs text-dark-400 mb-1">Price Change</p>
              <p className={`text-lg font-bold ${sessionResults.priceChange >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                {sessionResults.priceChange >= 0 ? '+' : ''}{sessionResults.priceChange?.toFixed(2)}%
              </p>
              <p className="text-xs text-dark-500">
                Max: {sessionResults.maxPriceReached?.toFixed(8)} SOL
              </p>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="space-y-2 text-sm border-t border-dark-800 pt-4">
            <div className="flex justify-between">
              <span className="text-dark-400">Avg Trade Size</span>
              <span className="text-white font-medium">
                {sessionResults.averageTradeSize?.toFixed(4)} SOL
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Total Fees</span>
              <span className="text-white font-medium">
                {sessionResults.totalFees?.toFixed(4)} SOL ({sessionResults.feePercentage?.toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Trades/Minute</span>
              <span className="text-white font-medium">
                {sessionResults.tradesPerMinute?.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Volume/Minute</span>
              <span className="text-white font-medium">
                {sessionResults.volumePerMinute?.toFixed(4)} SOL
              </span>
            </div>
          </div>

          {/* Reset Button */}
          <Button
            onClick={resetSimulator}
            variant="outline"
            className="w-full mt-4"
          >
            <RotateCcw size={16} />
            Run New Simulation
          </Button>
        </Card>
      )}
    </div>
  );
};

export default VolumeSimulator;
