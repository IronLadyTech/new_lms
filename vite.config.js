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
    /*
     * Worker threads rather than Vitest 4's default forked child processes.
     *
     * A run was seen failing collection on all 9 files at once — including
     * pure-Node ones — then passing on every retry. That signature is a worker
     * failing to spawn, not a test failing, and process spawning is the fragile
     * part on Windows (antivirus scanning, handle exhaustion). Threads remove
     * that failure mode instead of retrying around it, and start faster.
     */
    pool: 'threads',
    // Cold jsdom start-up has been measured above 100s on a fresh machine, and
    // CI always cold-starts. Headroom here costs nothing on a healthy run.
    testTimeout: 15_000,
    hookTimeout: 30_000,
    teardownTimeout: 15_000,
  },
});
