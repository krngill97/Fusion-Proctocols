import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Search,
  Users,
  TrendingUp,
  Bot,
  TestTube,
  Settings,
  Menu,
  X,
  LogOut,
  Wifi,
  WifiOff,
  ChevronDown,
  Globe,
  Zap,
  Rocket
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { NetworkToggle } from '../common';
import WalletButton from '../common/WalletButton';

const NETWORKS = [
  { id: 'mainnet-beta', name: 'Mainnet', color: 'success', rpc: 'https://api.mainnet-beta.solana.com' },
  { id: 'devnet', name: 'Devnet', color: 'warning', rpc: 'https://api.devnet.solana.com' },
  { id: 'testnet', name: 'Testnet', color: 'info', rpc: 'https://api.testnet.solana.com' },
];

const Layout = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isConnected } = useWebSocket();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [network, setNetwork] = useState('devnet');
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Real Token Launch', href: '/real-token-launch', icon: Rocket, badge: 'REAL' },
    { name: 'Token Launch (Sim)', href: '/token-launch', icon: Rocket },
    { name: 'Hot Wallets', href: '/hot-wallets', icon: Wallet },
    { name: 'Subwallets', href: '/subwallets', icon: Search },
    { name: 'My Wallets', href: '/user-wallets', icon: Users },
    { name: 'Trading', href: '/trading', icon: TrendingUp },
    { name: 'Volume Bot', href: '/volume-bot', icon: Bot },
    { name: 'Testnet Lab', href: '/testnet-lab', icon: TestTube },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const shortenAddress = (addr) => {
    if (!addr) return '0x...';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const currentNetwork = NETWORKS.find(n => n.id === network);

  return (
    <div className="flex h-screen bg-dark-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-52 bg-dark-900 border-r border-dark-800 transform transition-transform duration-200
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-3 h-12 border-b border-dark-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-primary-500 to-accent-purple flex items-center justify-center">
                <Zap size={14} className="text-white" />
              </div>
              <span className="font-bold text-white tracking-tight">FUSION</span>
            </div>
            <button 
              className="lg:hidden p-1 text-dark-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* Network Selector */}
          <div className="px-2 py-2 border-b border-dark-800">
            <div className="relative">
              <button
                onClick={() => setShowNetworkMenu(!showNetworkMenu)}
                className="w-full flex items-center justify-between px-2 py-1.5 bg-dark-800 rounded text-xs hover:bg-dark-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe size={12} className="text-dark-400" />
                  <span className={`network-${currentNetwork?.color}`}>
                    {currentNetwork?.name}
                  </span>
                </div>
                <ChevronDown size={12} className="text-dark-400" />
              </button>
              
              {showNetworkMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-dark-800 border border-dark-700 rounded shadow-lg z-50">
                  {NETWORKS.map((net) => (
                    <button
                      key={net.id}
                      onClick={() => {
                        setNetwork(net.id);
                        setShowNetworkMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-dark-700 transition-colors ${
                        network === net.id ? 'bg-dark-700' : ''
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        net.color === 'success' ? 'bg-success' :
                        net.color === 'warning' ? 'bg-warning' : 'bg-info'
                      }`}></span>
                      <span className="text-dark-200">{net.name}</span>
                      {network === net.id && (
                        <span className="ml-auto text-primary-400">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href));
              
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    isActive 
                      ? 'bg-primary-500/10 text-primary-400 border-l-2 border-primary-500 -ml-0.5 pl-2.5' 
                      : 'text-dark-400 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <item.icon size={16} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="border-t border-dark-800 p-2">
            {/* Connection Status */}
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <span className="text-2xs text-dark-500">Status</span>
              <div className="flex items-center gap-1.5">
                {isConnected ? (
                  <>
                    <span className="status-online"></span>
                    <span className="text-2xs text-success">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={10} className="text-dark-500" />
                    <span className="text-2xs text-dark-500">Offline</span>
                  </>
                )}
              </div>
            </div>

            {/* User Info */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-dark-800 rounded">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-dark-700 flex items-center justify-center flex-shrink-0">
                  <Wallet size={12} className="text-dark-400" />
                </div>
                <span className="text-xs text-dark-300 font-mono truncate">
                  {shortenAddress(user?.walletAddress)}
                </span>
              </div>
              <button 
                onClick={logout}
                className="p-1 text-dark-500 hover:text-error transition-colors flex-shrink-0"
                title="Disconnect"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-12 bg-dark-900 border-b border-dark-800 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="lg:hidden p-1.5 text-dark-400 hover:text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1 className="text-sm font-semibold text-white">
              {navigation.find(n => n.href === location.pathname)?.name || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Network Toggle */}
            <NetworkToggle />

            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-dark-500">SOL</span>
                <span className="text-white font-medium">$198.42</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-dark-500">Gas</span>
                <span className="text-success font-medium">Low</span>
              </div>
            </div>

            {/* Wallet Connect Button - Top Right */}
            <WalletButton />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
