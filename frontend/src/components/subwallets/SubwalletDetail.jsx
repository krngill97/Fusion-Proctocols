import { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  Zap, 
  Droplets, 
  ShoppingCart,
  Copy,
  Check,
  Clock,
  Wallet,
  ArrowUpRight,
  UserPlus
} from 'lucide-react';
import { subwalletApi, userWalletApi } from '../../services/api';
import { Badge } from '../common';
import toast from 'react-hot-toast';

const SubwalletDetail = ({ subwallet, onClose }) => {
  const [activeTab, setActiveTab] = useState('mints');
  const [mints, setMints] = useState([]);
  const [pools, setPools] = useState([]);
  const [buys, setBuys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [subwallet._id]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const [mintsRes, poolsRes, buysRes] = await Promise.all([
        subwalletApi.getById(subwallet._id),
        subwalletApi.getById(subwallet._id),
        subwalletApi.getById(subwallet._id)
      ]);

      const data = mintsRes.data.data;
      setMints(data.activity?.mintedTokens || []);
      setPools(data.activity?.createdPools || []);
      setBuys(data.activity?.tokenPurchases || []);
    } catch (error) {
      toast.error('Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(subwallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Address copied');
  };

  const handleImportToWallets = async () => {
    try {
      await userWalletApi.importFromSubwallet(subwallet._id);
      toast.success('Added to your wallets');
    } catch (error) {
      toast.error('Failed to import wallet');
    }
  };

  const shortenAddress = (addr) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  const tabs = [
    { id: 'mints', label: 'Mints', icon: Zap, count: mints.length },
    { id: 'pools', label: 'Pools', icon: Droplets, count: pools.length },
    { id: 'buys', label: 'Buys', icon: ShoppingCart, count: buys.length },
  ];

  return (
    <>
      {/* Overlay */}
      <div className="modal-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="modal-content max-w-2xl">
        {/* Header */}
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-semibold text-white">Subwallet Details</h2>
                <Badge variant={subwallet.status === 'watching' ? 'success' : 'default'}>
                  {subwallet.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-dark-300">{shortenAddress(subwallet.address)}</span>
                <button onClick={handleCopy} className="text-dark-400 hover:text-white">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <a
                  href={`https://solscan.io/account/${subwallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dark-400 hover:text-primary-400"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-dark-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-dark-800 rounded-lg p-3">
              <p className="text-dark-400 text-xs">Source</p>
              <p className="text-white font-medium">{subwallet.sourceExchange || 'Unknown'}</p>
            </div>
            <div className="bg-dark-800 rounded-lg p-3">
              <p className="text-dark-400 text-xs">Initial Transfer</p>
              <p className="text-white font-medium">{subwallet.initialTransferAmount?.toFixed(4)} SOL</p>
            </div>
            <div className="bg-dark-800 rounded-lg p-3">
              <p className="text-dark-400 text-xs">Transactions</p>
              <p className="text-white font-medium">{subwallet.activity?.transactionCount || 0}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button onClick={handleImportToWallets} className="btn btn-secondary btn-sm flex items-center gap-2">
              <UserPlus size={14} />
              Add to My Wallets
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-dark-700">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-white'
                    : 'border-transparent text-dark-400 hover:text-white'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
                {tab.count > 0 && (
                  <span className="bg-dark-700 px-1.5 py-0.5 rounded text-xs">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="spinner mx-auto"></div>
            </div>
          ) : (
            <>
              {activeTab === 'mints' && <MintsList mints={mints} />}
              {activeTab === 'pools' && <PoolsList pools={pools} />}
              {activeTab === 'buys' && <BuysList buys={buys} />}
            </>
          )}
        </div>
      </div>
    </>
  );
};

// Mints List
const MintsList = ({ mints }) => {
  if (mints.length === 0) {
    return (
      <div className="text-center py-8">
        <Zap className="mx-auto text-dark-500 mb-2" size={24} />
        <p className="text-dark-400">No mints detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mints.map((mint, index) => (
        <div key={index} className="bg-dark-800 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium text-white">{mint.tokenSymbol || 'Unknown Token'}</p>
              <p className="text-sm text-dark-400">{mint.tokenName || 'No name'}</p>
            </div>
            <Badge variant="purple">{mint.platform || 'Unknown'}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-dark-400">
            <span className="font-mono">{mint.mintAddress?.slice(0, 12)}...</span>
            <a
              href={`https://solscan.io/token/${mint.mintAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-400 hover:underline flex items-center gap-1"
            >
              View <ExternalLink size={10} />
            </a>
          </div>
          <p className="text-xs text-dark-500 mt-2">
            {new Date(mint.timestamp).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
};

// Pools List
const PoolsList = ({ pools }) => {
  if (pools.length === 0) {
    return (
      <div className="text-center py-8">
        <Droplets className="mx-auto text-dark-500 mb-2" size={24} />
        <p className="text-dark-400">No pools created</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pools.map((pool, index) => (
        <div key={index} className="bg-dark-800 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium text-white">{pool.platform} Pool</p>
              <p className="text-sm font-mono text-dark-400">{pool.poolAddress?.slice(0, 16)}...</p>
            </div>
            <Badge variant="info">{pool.platform}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <a
              href={`https://solscan.io/account/${pool.poolAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-400 hover:underline flex items-center gap-1"
            >
              View Pool <ExternalLink size={10} />
            </a>
          </div>
          <p className="text-xs text-dark-500 mt-2">
            {new Date(pool.timestamp).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
};

// Buys List
const BuysList = ({ buys }) => {
  if (buys.length === 0) {
    return (
      <div className="text-center py-8">
        <ShoppingCart className="mx-auto text-dark-500 mb-2" size={24} />
        <p className="text-dark-400">No token purchases</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {buys.map((buy, index) => (
        <div key={index} className="bg-dark-800 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium text-white">{buy.tokenSymbol || 'Unknown'}</p>
              <p className="text-sm text-dark-400">
                {buy.amount?.toLocaleString()} tokens for {buy.solSpent?.toFixed(4)} SOL
              </p>
            </div>
            <Badge variant="success">{buy.dex || 'Unknown DEX'}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-dark-400">
            <span>Price: {buy.pricePerToken?.toFixed(8)} SOL</span>
          </div>
          <p className="text-xs text-dark-500 mt-2">
            {new Date(buy.timestamp).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
};

export default SubwalletDetail;
