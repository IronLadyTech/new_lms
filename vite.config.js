import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // Pre-warm the heaviest entry modules so first navigation is snappy.
    warmup: {
      clientFiles: ['./src/main.jsx', './src/App.jsx', './src/firebase/config.js'],
    },
  },
  // Pre-bundle big deps once on startup for faster cold loads.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        // Split vendor code so the browser caches React/Firebase separately
        // and the app shell loads faster.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
          ],
        },
      },
    },
  },
});
