import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Buffer } from 'buffer';
import App from './App';
import { NetworkProvider } from './context/NetworkContext';
import { WalletProvider } from './context/WalletContext';
import { AuthProvider } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import './styles/index.css';

// Polyfill for Solana wallet adapters
window.Buffer = Buffer;

// Clear any stale auth tokens on fresh load (demo mode)
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <NetworkProvider>
      <WalletProvider>
        <AuthProvider>
          <WebSocketProvider>
            <App />
          </WebSocketProvider>
        </AuthProvider>
      </WalletProvider>
    </NetworkProvider>
  </BrowserRouter>
);
