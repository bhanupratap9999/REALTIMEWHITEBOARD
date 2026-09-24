import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — cached aggressively, rarely changes
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Fabric.js canvas engine — largest dep, split separately
          'vendor-fabric': ['fabric'],
          // Socket.IO client
          'vendor-socket': ['socket.io-client'],
          // Lucide icon tree-shake chunk
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});

