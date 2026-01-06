import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      buffer: 'buffer',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        // Don't error if backend is not running
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('Proxy error (backend may not be running):', err.message);
          });
        },
      },
      '/ws': {
        target: 'ws://localhost:5001',
        ws: true,
        // Don't error if backend WebSocket is not running
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('WebSocket proxy error:', err.message);
          });
        },
      },
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
