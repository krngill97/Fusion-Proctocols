import { useState } from 'react';
import { 
  ArrowDown, 
  RefreshCw, 
  Settings, 
  AlertCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { tradingApi } from '../../services/api';
import toast from 'react-hot-toast';

// Native SOL mint
const SOL_MINT = 'So11111111111111111111111111111111111111112';

const SwapPanel = ({ onTradeComplete }) => {
  const [mode, setMode] = useState('buy'); // buy or sell
  const [tokenMint, setTokenMint] = useState('');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');

  const handleGetQuote = async () => {
    if (!tokenMint || !amount) {
      setError('Please enter token address and amount');
      return;
    }

    setError('');
    setQuoteLoading(true);
    
    try {
      const response = await tradingApi.getQuote({
        tokenMint,
        amount: parseFloat(amount),
        type: mode,
        slippageBps: parseInt(slippage) * 100
      });
      
      setQuote(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to get quote');
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!tokenMint || !amount) {
      setError('Please enter token address and amount');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const tradeData = {
        tokenMint,
        slippageBps: parseInt(slippage) * 100
      };

      if (mode === 'buy') {
        tradeData.solAmount = parseFloat(amount);
        await tradingApi.buy(tradeData);
      } else {
        tradeData.tokenAmount = parseFloat(amount);
        await tradingApi.sell(tradeData);
      }

      toast.success(`${mode === 'buy' ? 'Buy' : 'Sell'} order submitted!`);
      setAmount('');
      setQuote(null);
      onTradeComplete?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Trade failed');
      toast.error('Trade failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('buy')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              mode === 'buy'
                ? 'bg-success text-white'
                : 'bg-dark-800 text-dark-400 hover:text-white'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setMode('sell')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              mode === 'sell'
                ? 'bg-error text-white'
                : 'bg-dark-800 text-dark-400 hover:text-white'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Token Input */}
        <div className="mb-4">
          <label className="label">Token Address</label>
          <input
            type="text"
            value={tokenMint}
            onChange={(e) => setTokenMint(e.target.value)}
            placeholder="Enter token mint address"
            className="input font-mono text-sm"
          />
        </div>

        {/* From Token */}
        <div className="bg-dark-800 rounded-lg p-4 mb-2">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-dark-400">
              {mode === 'buy' ? 'You pay' : 'You sell'}
            </span>
            <span className="text-sm text-dark-400">
              Balance: --
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl text-white outline-none"
            />
            <div className="flex items-center gap-2 px-3 py-2 bg-dark-700 rounded-lg">
              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full"></div>
              <span className="font-medium text-white">
                {mode === 'buy' ? 'SOL' : 'Token'}
              </span>
            </div>
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="flex justify-center -my-2 relative z-10">
          <div className="w-10 h-10 bg-dark-800 border-4 border-dark-900 rounded-lg flex items-center justify-center">
            <ArrowDown className="text-dark-400" size={18} />
          </div>
        </div>

        {/* To Token */}
        <div className="bg-dark-800 rounded-lg p-4 mt-2 mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-dark-400">
              {mode === 'buy' ? 'You receive' : 'You receive'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex-1 text-2xl text-white">
              {quote ? quote.outAmount?.toLocaleString() : '0.0'}
            </span>
            <div className="flex items-center gap-2 px-3 py-2 bg-dark-700 rounded-lg">
              <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full"></div>
              <span className="font-medium text-white">
                {mode === 'buy' ? 'Token' : 'SOL'}
              </span>
            </div>
          </div>
        </div>

        {/* Quote Info */}
        {quote && (
          <div className="bg-dark-800 rounded-lg p-3 mb-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-dark-400">Rate</span>
              <span className="text-white">
                1 {mode === 'buy' ? 'SOL' : 'Token'} = {quote.rate?.toFixed(6)} {mode === 'buy' ? 'Token' : 'SOL'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Price Impact</span>
              <span className={quote.priceImpact > 5 ? 'text-error' : 'text-white'}>
                {quote.priceImpact?.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Route</span>
              <span className="text-white">{quote.dex || 'Jupiter'}</span>
            </div>
          </div>
        )}

        {/* Settings Toggle */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-sm text-dark-400 hover:text-white mb-4"
        >
          <Settings size={14} />
          Settings
        </button>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-dark-800 rounded-lg p-4 mb-4">
            <label className="label">Slippage Tolerance</label>
            <div className="flex gap-2">
              {['0.5', '1', '2', '5'].map((val) => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  className={`px-3 py-1.5 rounded text-sm ${
                    slippage === val
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-700 text-dark-400 hover:text-white'
                  }`}
                >
                  {val}%
                </button>
              ))}
              <input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-16 px-2 py-1.5 bg-dark-700 rounded text-sm text-white text-center"
                placeholder="Custom"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleGetQuote}
            disabled={quoteLoading || !tokenMint || !amount}
            className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            {quoteLoading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}
            Get Quote
          </button>
          <button
            onClick={handleSwap}
            disabled={loading || !tokenMint || !amount}
            className={`btn flex-1 flex items-center justify-center gap-2 ${
              mode === 'buy' ? 'btn-success' : 'btn-danger'
            }`}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              mode === 'buy' ? 'Buy' : 'Sell'
            )}
          </button>
        </div>

        {/* Warning */}
        <p className="text-xs text-dark-500 mt-4 text-center">
          Trading involves risk. Please verify all details before confirming.
        </p>
      </div>
    </div>
  );
};

export default SwapPanel;
