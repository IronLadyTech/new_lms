import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    warmup: {
      clientFiles: ['./src/main.jsx', './src/App.jsx', './src/firebase/config.js'],
    },
  },
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
  test: {
    // Node by default — component tests opt into jsdom with a per-file
    // `@vitest-environment jsdom` docblock, so pure logic keeps the fast path.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    globals: false,
    // Cold jsdom start-up has been observed taking >100s on a fresh machine,
    // which can fail whole-file collection. CI always cold-starts, so give
    // set-up real headroom rather than trading it for a flaky red build.
    testTimeout: 15_000,
    hookTimeout: 30_000,
    teardownTimeout: 15_000,
  },
});
