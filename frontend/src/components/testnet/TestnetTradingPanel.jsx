import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle } from 'lucide-react';
import { Button, Card, Input, Spinner, Badge } from '../common';
import { testnetTradeApi, testnetTokenApi } from '../../services/api';
import toast from 'react-hot-toast';

const TestnetTradingPanel = ({ token, onTradeComplete }) => {
  const { publicKey } = useWallet();

  const [tradeType, setTradeType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);

  // Fetch user's token balance
  useEffect(() => {
    if (publicKey && token) {
      fetchBalance();
    }
  }, [publicKey, token?.mint]);

  const fetchBalance = async () => {
    try {
      const res = await testnetTokenApi.getBalance(token.mint, publicKey.toBase58());
      setBalance(res.data.balance || 0);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  // Estimate trade when amount changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (amount && parseFloat(amount) > 0) {
        estimateTrade();
      } else {
        setEstimate(null);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [amount, tradeType, token?.mint]);

  const estimateTrade = async () => {
    try {
      setEstimating(true);
      const res = await testnetTradeApi.estimate({
        tokenMint: token.mint,
        type: tradeType,
        amount: parseFloat(amount)
      });
      setEstimate(res.data.estimate);
    } catch (error) {
      console.error('Estimate error:', error);
      setEstimate(null);
    } finally {
      setEstimating(false);
    }
  };

  const handleTrade = async () => {
    if (!publicKey) {
      toast.error('Connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      toast.loading(`${tradeType === 'buy' ? 'Buying' : 'Selling'}...`, { id: 'trade' });

      const res = await testnetTradeApi.execute({
        tokenMint: token.mint,
        wallet: publicKey.toBase58(),
        type: tradeType,
        amount: parseFloat(amount)
      });

      if (res.data.success) {
        toast.success(
          `${tradeType === 'buy' ? 'Bought' : 'Sold'} ${res.data.trade.tokenAmount.toLocaleString()} ${token.symbol}!`,
          { id: 'trade' }
        );

        // Reset form
        setAmount('');
        setEstimate(null);

        // Refresh balance and token data
        fetchBalance();
        if (onTradeComplete) {
          onTradeComplete(res.data.trade, res.data.token);
        }
      }
    } catch (error) {
      console.error('Trade error:', error);
      toast.error(error.response?.data?.message || 'Trade failed', { id: 'trade' });
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = tradeType === 'buy'
    ? [0.01, 0.05, 0.1, 0.5, 1]
    : [10, 25, 50, 75, 100]; // percentages for sell

  return (
    <Card className="p-5">
      {/* Trade Type Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          onClick={() => {
            setTradeType('buy');
            setAmount('');
            setEstimate(null);
          }}
          variant={tradeType === 'buy' ? 'success' : 'ghost'}
          className="flex-1"
        >
          <ArrowUpRight size={16} />
          Buy
        </Button>
        <Button
          onClick={() => {
            setTradeType('sell');
            setAmount('');
            setEstimate(null);
          }}
          variant={tradeType === 'sell' ? 'danger' : 'ghost'}
          className="flex-1"
        >
          <ArrowDownRight size={16} />
          Sell
        </Button>
      </div>

      {/* Balance Display */}
      {publicKey && (
        <div className="bg-dark-900 rounded-lg p-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-dark-400">Your Balance</span>
            <span className="text-white font-medium">
              {balance.toLocaleString()} {token.symbol}
            </span>
          </div>
        </div>
      )}

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-dark-300 mb-2">
          {tradeType === 'buy' ? 'SOL Amount' : 'Token Amount'}
        </label>
        <div className="relative">
          <input
            type="number"
            step={tradeType === 'buy' ? '0.01' : '1'}
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={tradeType === 'buy' ? '0.00 SOL' : `0 ${token.symbol}`}
            className="w-full px-4 py-3 bg-dark-900 border border-dark-700 rounded-lg text-white text-lg font-medium focus:outline-none focus:border-primary-500"
            disabled={loading}
          />
          {estimating && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Spinner size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Quick Amount Buttons */}
      <div className="flex gap-2 mb-4">
        {quickAmounts.map((quickAmount) => (
          <Button
            key={quickAmount}
            size="sm"
            variant="ghost"
            onClick={() => {
              if (tradeType === 'buy') {
                setAmount(quickAmount.toString());
              } else {
                // Calculate percentage of balance
                const tokenAmount = (balance * quickAmount) / 100;
                setAmount(tokenAmount.toString());
              }
            }}
            className="flex-1 text-xs"
          >
            {tradeType === 'buy' ? `${quickAmount} SOL` : `${quickAmount}%`}
          </Button>
        ))}
      </div>

      {/* Estimate Display */}
      {estimate && (
        <div className="bg-dark-900 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-dark-400">
              You {tradeType === 'buy' ? 'receive' : 'get'}
            </span>
            <span className="font-semibold text-white">
              {tradeType === 'buy'
                ? `~${estimate.outputAmount.toLocaleString()} ${token.symbol}`
                : `~${estimate.outputAmount.toFixed(6)} SOL`
              }
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-dark-500">Price per token</span>
            <span className="text-dark-300 font-mono">
              {estimate.pricePerToken.toFixed(8)} SOL
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-dark-500">Price impact</span>
            <span className={estimate.priceImpact > 5 ? 'text-warning-400' : 'text-dark-300'}>
              {estimate.priceImpact >= 0 ? '+' : ''}{estimate.priceImpact.toFixed(2)}%
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-dark-500">Total fees</span>
            <span className="text-dark-300">
              {estimate.totalFee.toFixed(6)} SOL ({estimate.feePercentage.toFixed(2)}%)
            </span>
          </div>

          {estimate.priceImpact > 10 && (
            <div className="flex items-center gap-2 text-xs text-warning-400 mt-2">
              <AlertCircle size={14} />
              <span>High price impact! Consider smaller trades.</span>
            </div>
          )}
        </div>
      )}

      {/* Trade Button */}
      <Button
        onClick={handleTrade}
        disabled={loading || !publicKey || !amount || parseFloat(amount) <= 0}
        className="w-full h-12"
        variant={tradeType === 'buy' ? 'success' : 'danger'}
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <>
            {tradeType === 'buy' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            {tradeType === 'buy' ? 'Buy' : 'Sell'} {token.symbol}
          </>
        )}
      </Button>

      {/* Warning for not connected */}
      {!publicKey && (
        <p className="text-xs text-dark-500 text-center mt-3">
          Connect your wallet to trade
        </p>
      )}
    </Card>
  );
};

export default TestnetTradingPanel;
