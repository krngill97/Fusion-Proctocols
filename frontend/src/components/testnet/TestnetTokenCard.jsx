import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Users, Activity, Copy, ExternalLink } from 'lucide-react';
import { Card, Badge, Button } from '../common';
import toast from 'react-hot-toast';

const TestnetTokenCard = ({ token, compact = false }) => {
  const {
    mint,
    name,
    symbol,
    imageUrl,
    description,
    bondingCurve,
    marketCap,
    volume24h,
    priceChange24h,
    holders,
    transactions,
    currentSupply,
    totalSupply,
    createdAt
  } = token;

  const soldPercentage = (currentSupply / totalSupply) * 100;
  const priceFormatted = bondingCurve?.currentPrice?.toFixed(8) || '0.00000001';
  const isPositiveChange = priceChange24h >= 0;

  const copyMint = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(mint);
    toast.success('Mint address copied!');
  };

  if (compact) {
    return (
      <Link to={`/testnet/token/${mint}`}>
        <Card className="p-4 hover:border-primary-600 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <img
              src={imageUrl}
              alt={symbol}
              className="w-10 h-10 rounded-lg flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white truncate">{name}</span>
                <Badge variant="warning" size="xs">{symbol}</Badge>
              </div>
              <p className="text-xs text-dark-400">{priceFormatted} SOL</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${isPositiveChange ? 'text-success-400' : 'text-danger-400'}`}>
                {isPositiveChange ? '+' : ''}{priceChange24h.toFixed(2)}%
              </p>
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link to={`/testnet/token/${mint}`}>
      <Card className="p-5 hover:border-primary-600 transition-colors cursor-pointer">
        <div className="flex items-start gap-4">
          {/* Token Image */}
          <img
            src={imageUrl}
            alt={symbol}
            className="w-14 h-14 rounded-xl flex-shrink-0"
          />

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-white text-lg truncate">{name}</span>
              <Badge variant="warning">{symbol}</Badge>
            </div>

            {description && (
              <p className="text-xs text-dark-400 mb-3 line-clamp-2">{description}</p>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div>
                <p className="text-2xs text-dark-500">Price</p>
                <p className="text-sm font-medium text-white">{priceFormatted}</p>
              </div>
              <div>
                <p className="text-2xs text-dark-500">Market Cap</p>
                <p className="text-sm font-medium text-white">{marketCap.toFixed(2)} SOL</p>
              </div>
              <div>
                <p className="text-2xs text-dark-500">Volume 24h</p>
                <p className="text-sm font-medium text-white">{volume24h.toFixed(2)} SOL</p>
              </div>
              <div>
                <p className="text-2xs text-dark-500">Change 24h</p>
                <p className={`text-sm font-medium ${isPositiveChange ? 'text-success-400' : 'text-danger-400'}`}>
                  {isPositiveChange ? '+' : ''}{priceChange24h.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-2xs text-dark-500 mb-1">
                <span>Bonding Curve Progress</span>
                <span>{soldPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-accent-purple"
                  style={{ width: `${soldPercentage}%` }}
                />
              </div>
            </div>

            {/* Bottom Stats */}
            <div className="flex items-center gap-4 text-xs text-dark-400">
              <div className="flex items-center gap-1">
                <Users size={12} />
                <span>{holders} holders</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity size={12} />
                <span>{transactions} txs</span>
              </div>
              <button
                onClick={copyMint}
                className="flex items-center gap-1 hover:text-primary-400 transition-colors"
              >
                <Copy size={12} />
                <span>{mint.slice(0, 6)}...{mint.slice(-4)}</span>
              </button>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default TestnetTokenCard;
