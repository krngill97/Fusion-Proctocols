import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import HotWallets from './pages/HotWallets';
import Subwallets from './pages/Subwallets';
import UserWallets from './pages/UserWallets';
import Trading from './pages/Trading';
import VolumeBot from './pages/VolumeBot';
import TestnetLab from './pages/TestnetLab';
import TestnetTokenPage from './pages/TestnetTokenPage';
import TokenLaunch from './pages/TokenLaunch';
import RealTokenLaunch from './pages/RealTokenLaunch';
import TradableTokens from './pages/TradableTokens';
import TokensListPage from './pages/TokensListPage';
import TokenDetailPage from './pages/TokenDetailPage';
import AdvancedVolumeBots from './pages/AdvancedVolumeBots';
import LiveChartPage from './pages/LiveChartPage';
import Settings from './pages/Settings';
import ConnectWallet from './pages/ConnectWallet';

// DEMO MODE - No authentication required, all routes accessible
function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-dark-800 text-white border border-dark-700',
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      <Routes>
        {/* Connect page */}
        <Route path="/connect" element={<ConnectWallet />} />

        {/* All routes accessible without auth in demo mode */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="hot-wallets" element={<HotWallets />} />
          <Route path="subwallets" element={<Subwallets />} />
          <Route path="user-wallets" element={<UserWallets />} />
          <Route path="trading" element={<Trading />} />
          <Route path="volume-bot" element={<VolumeBot />} />
          <Route path="advanced-bots" element={<AdvancedVolumeBots />} />
          <Route path="testnet" element={<TestnetLab />} />
          <Route path="testnet-lab" element={<TestnetLab />} />
          <Route path="testnet/token/:mint" element={<TestnetTokenPage />} />
          <Route path="tokens" element={<TradableTokens />} />
          <Route path="explorer" element={<TokensListPage />} />
          <Route path="token/:mint" element={<TokenDetailPage />} />
          <Route path="chart/:mint" element={<LiveChartPage />} />
          <Route path="token-launch" element={<TokenLaunch />} />
          <Route path="real-token-launch" element={<RealTokenLaunch />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
