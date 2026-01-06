import axios from 'axios';

// DEMO MODE - Don't redirect on API errors
const DEMO_MODE = true;

// Create axios instance
const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors gracefully in demo mode
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // In demo mode, don't redirect - just reject the promise
    if (DEMO_MODE) {
      return Promise.reject(error);
    }

    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Try to refresh
        const response = await axios.post('/api/auth/refresh', { refreshToken });
        const { accessToken } = response.data;

        localStorage.setItem('accessToken', accessToken);

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // Refresh failed, clear tokens - NO REDIRECT in demo mode
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// API endpoints
export const authApi = {
  getNonce: (walletAddress) => api.get(`/auth/nonce?walletAddress=${walletAddress}`),
  verify: (data) => api.post('/auth/verify', data),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  getMe: () => api.get('/auth/me'),
  updatePreferences: (data) => api.patch('/auth/preferences', data),
};

export const hotWalletApi = {
  getAll: (params) => api.get('/hot-wallets', { params }),
  getById: (id) => api.get(`/hot-wallets/${id}`),
  add: (data) => api.post('/hot-wallets', data),
  update: (id, data) => api.patch(`/hot-wallets/${id}`, data),
  remove: (id) => api.delete(`/hot-wallets/${id}`),
  toggle: (id) => api.patch(`/hot-wallets/${id}/toggle`),
  getStats: () => api.get('/hot-wallets/stats'),
  getTransfers: (params) => api.get('/hot-wallets/transfers', { params }),
  getTrackerStatus: () => api.get('/hot-wallets/tracker/status'),
  startTracker: () => api.post('/hot-wallets/tracker/start'),
  stopTracker: () => api.post('/hot-wallets/tracker/stop'),
};

export const subwalletApi = {
  getAll: (params) => api.get('/subwallets', { params }),
  getById: (id) => api.get(`/subwallets/${id}`),
  getStats: () => api.get('/subwallets/stats'),
  getRecentMints: (limit) => api.get('/subwallets/mints/recent', { params: { limit } }),
  getActive: () => api.get('/subwallets/active'),
  getWatching: () => api.get('/subwallets/watching'),
  extendWatchTime: (id, hours) => api.patch(`/subwallets/${id}/extend`, { hours }),
  getAnalyzerStatus: () => api.get('/subwallets/analyzer/status'),
  startAnalyzer: () => api.post('/subwallets/analyzer/start'),
  stopAnalyzer: () => api.post('/subwallets/analyzer/stop'),
};

export const userWalletApi = {
  getAll: (params) => api.get('/user-wallets', { params }),
  getById: (id) => api.get(`/user-wallets/${id}`),
  add: (data) => api.post('/user-wallets', data),
  update: (id, data) => api.patch(`/user-wallets/${id}`, data),
  remove: (id) => api.delete(`/user-wallets/${id}`),
  toggle: (id) => api.patch(`/user-wallets/${id}/toggle`),
  getSignals: (id, params) => api.get(`/user-wallets/${id}/signals`, { params }),
  getAllSignals: (params) => api.get('/user-wallets/signals/all', { params }),
  getStats: () => api.get('/user-wallets/stats'),
  importFromSubwallet: (subwalletId) => api.post('/user-wallets/import/subwallet', { subwalletId }),
};

export const tradingApi = {
  getQuote: (data) => api.post('/trading/quote', data),
  simulate: (data) => api.post('/trading/simulate', data),
  buy: (data) => api.post('/trading/buy', data),
  sell: (data) => api.post('/trading/sell', data),
  getHistory: (params) => api.get('/trading/history', { params }),
  getTradeById: (id) => api.get(`/trading/trades/${id}`),
  cancelTrade: (id) => api.post(`/trading/trades/${id}/cancel`),
  getStats: () => api.get('/trading/stats'),
  getTokenPrice: (tokenMint) => api.get(`/trading/price/${tokenMint}`),
  getTokenInfo: (tokenMint) => api.get(`/trading/token/${tokenMint}`),
  // Auto trade
  getAutoStatus: () => api.get('/trading/auto/status'),
  getAutoSettings: () => api.get('/trading/auto/settings'),
  updateAutoSettings: (data) => api.patch('/trading/auto/settings', data),
  enableAuto: () => api.post('/trading/auto/enable'),
  disableAuto: () => api.post('/trading/auto/disable'),
};

export const volumeApi = {
  getStatus: () => api.get('/volume/status'),
  getSessions: (params) => api.get('/volume/sessions', { params }),
  getSession: (id) => api.get(`/volume/sessions/${id}`),
  createSession: (data) => api.post('/volume/sessions', data),
  startSession: (id) => api.post(`/volume/sessions/${id}/start`),
  pauseSession: (id) => api.post(`/volume/sessions/${id}/pause`),
  resumeSession: (id) => api.post(`/volume/sessions/${id}/resume`),
  stopSession: (id) => api.post(`/volume/sessions/${id}/stop`),
  getTransactions: (id, params) => api.get(`/volume/sessions/${id}/transactions`, { params }),
  getSessionStats: (id) => api.get(`/volume/sessions/${id}/stats`),
};

export const settingsApi = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.patch('/settings', data),
  getRpcSettings: () => api.get('/settings/rpc'),
  addRpcEndpoint: (data) => api.post('/settings/rpc/endpoints', data),
  removeRpcEndpoint: (id) => api.delete(`/settings/rpc/endpoints/${id}`),
  setPrimaryEndpoint: (id) => api.patch(`/settings/rpc/endpoints/${id}/primary`),
  testEndpoint: (id) => api.post(`/settings/rpc/endpoints/${id}/test`),
};

// ==========================================
// Real Solana Devnet API (Real Blockchain)
// ==========================================

export const realTokenApi = {
  // Real token creation (on Solana blockchain)
  create: (data) => api.post('/solana/tokens/create', data),
  getMetadata: (mint, network = 'devnet') => api.get(`/solana/tokens/${mint}/metadata`, { params: { network } }),
  getBalance: (mint, wallet, network = 'devnet') => api.get(`/solana/tokens/${mint}/balance/${wallet}`, { params: { network } }),
  getHolders: (mint, network = 'devnet') => api.get(`/solana/tokens/${mint}/holders`, { params: { network } }),
};

// ==========================================
// Testnet Trading Simulator API (Database Only)
// ==========================================

export const testnetTokenApi = {
  // Token management (simulated, MongoDB only)
  create: (data) => api.post('/testnet/tokens', data),
  getAll: (params) => api.get('/testnet/tokens', { params }),
  getById: (mint) => api.get(`/testnet/tokens/${mint}`),
  getTrending: (limit = 10) => api.get('/testnet/tokens/trending', { params: { limit } }),
  getNew: (limit = 10) => api.get('/testnet/tokens/new', { params: { limit } }),
  search: (q, params) => api.get('/testnet/tokens/search', { params: { q, ...params } }),
  getByCreator: (wallet, params) => api.get(`/testnet/tokens/creator/${wallet}`, { params }),

  // Token details
  getStats: (mint) => api.get(`/testnet/tokens/${mint}/stats`),
  getBalance: (mint, wallet) => api.get(`/testnet/tokens/${mint}/balance/${wallet}`),
  getHolders: (mint, params) => api.get(`/testnet/tokens/${mint}/holders`, { params }),
  getDistribution: (mint) => api.get(`/testnet/tokens/${mint}/distribution`),
  getPriceHistory: (mint, limit = 100) => api.get(`/testnet/tokens/${mint}/price-history`, { params: { limit } }),
};

export const testnetTradeApi = {
  // Trading
  estimate: (data) => api.post('/testnet/trades/estimate', data),
  execute: (data) => api.post('/testnet/trades/execute', data),

  // Trade history
  getByToken: (mint, params) => api.get(`/testnet/trades/${mint}`, { params }),
  getRecent: (mint, limit = 20) => api.get(`/testnet/trades/${mint}/recent`, { params: { limit } }),
  getByWallet: (wallet, params) => api.get(`/testnet/trades/wallet/${wallet}`, { params }),
  getBySignature: (signature) => api.get(`/testnet/trades/tx/${signature}`),

  // Stats
  getStats: (mint) => api.get(`/testnet/trades/${mint}/stats`),
  get24hVolume: (mint) => api.get(`/testnet/trades/${mint}/volume24h`),
};

export const testnetVolumeApi = {
  // Session management
  startSession: (data) => api.post('/testnet/volume/sessions', data),
  getSessions: (params) => api.get('/testnet/volume/sessions', { params }),
  getSession: (id) => api.get(`/testnet/volume/sessions/${id}`),
  stopSession: (id, wallet) => api.post(`/testnet/volume/sessions/${id}/stop`, { wallet }),
  pauseSession: (id, wallet) => api.post(`/testnet/volume/sessions/${id}/pause`, { wallet }),
  resumeSession: (id, wallet) => api.post(`/testnet/volume/sessions/${id}/resume`, { wallet }),

  // Session details
  getSessionTrades: (id, limit = 100) => api.get(`/testnet/volume/sessions/${id}/trades`, { params: { limit } }),
  getTokenSessions: (mint, params) => api.get(`/testnet/volume/sessions/token/${mint}`, { params }),

  // Stats
  getStats: (wallet) => api.get('/testnet/volume/stats', { params: { wallet } }),
};
