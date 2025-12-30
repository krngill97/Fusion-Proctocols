import { Card } from '../common';

const TestnetBondingCurve = ({ token }) => {
  const {
    bondingCurve,
    currentSupply,
    totalSupply,
    marketCap,
    holders
  } = token;

  const soldPercentage = (currentSupply / totalSupply) * 100;
  const priceProgress = bondingCurve?.currentPrice && bondingCurve?.maxPrice
    ? ((bondingCurve.currentPrice - bondingCurve.basePrice) /
       (bondingCurve.maxPrice - bondingCurve.basePrice)) * 100
    : 0;

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Bonding Curve</h3>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-dark-400 mb-2">
          <span>Progress</span>
          <span>{soldPercentage.toFixed(2)}% sold</span>
        </div>
        <div className="h-3 bg-dark-800 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-primary-500 via-accent-purple to-accent-pink transition-all duration-300"
            style={{ width: `${soldPercentage}%` }}
          />
          {/* Milestone markers */}
          <div className="absolute top-0 left-1/4 h-full w-px bg-dark-600" />
          <div className="absolute top-0 left-1/2 h-full w-px bg-dark-600" />
          <div className="absolute top-0 left-3/4 h-full w-px bg-dark-600" />
        </div>
        <div className="flex justify-between text-2xs text-dark-500 mt-1">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-dark-400">Tokens Sold</span>
          <span className="text-white font-medium">
            {currentSupply.toLocaleString()} / {totalSupply.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-dark-400">SOL in Pool</span>
          <span className="text-white font-medium">
            {bondingCurve?.reserveSOL?.toFixed(4) || '0.0000'} SOL
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-dark-400">Current Price</span>
          <span className="text-white font-medium font-mono">
            {bondingCurve?.currentPrice?.toFixed(8) || '0.00000001'} SOL
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-dark-400">Starting Price</span>
          <span className="text-dark-500 font-mono">
            {bondingCurve?.basePrice?.toFixed(8) || '0.00000001'} SOL
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-dark-400">Max Price</span>
          <span className="text-dark-500 font-mono">
            {bondingCurve?.maxPrice?.toFixed(6) || '0.010000'} SOL
          </span>
        </div>

        <div className="border-t border-dark-800 pt-3 mt-3">
          <div className="flex justify-between text-sm">
            <span className="text-dark-400">Market Cap</span>
            <span className="text-white font-semibold">
              {marketCap.toFixed(4)} SOL
            </span>
          </div>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-dark-400">Holders</span>
          <span className="text-white font-medium">
            {holders}
          </span>
        </div>
      </div>

      {/* Price Curve Visualization */}
      <div className="mt-6 pt-4 border-t border-dark-800">
        <p className="text-xs text-dark-500 mb-3">Price Curve (Linear)</p>
        <div className="relative h-20 bg-dark-900 rounded-lg overflow-hidden">
          {/* Curve line */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            {/* Linear curve from bottom-left to top-right */}
            <line
              x1="0"
              y1="100%"
              x2="100%"
              y2="0"
              stroke="url(#curveGradient)"
              strokeWidth="2"
            />
            {/* Current position marker */}
            <circle
              cx={`${soldPercentage}%`}
              cy={`${100 - soldPercentage}%`}
              r="4"
              fill="#8b5cf6"
              stroke="#fff"
              strokeWidth="2"
            />
          </svg>

          {/* Labels */}
          <div className="absolute bottom-1 left-2 text-2xs text-dark-500">
            Base: {bondingCurve?.basePrice?.toFixed(8)}
          </div>
          <div className="absolute top-1 right-2 text-2xs text-dark-500">
            Max: {bondingCurve?.maxPrice?.toFixed(6)}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TestnetBondingCurve;
