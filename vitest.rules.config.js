import { defineConfig } from 'vitest/config';

/**
 * Emulator-backed tests: security rules, and the write paths that change data.
 * Both need `npm run test:rules`, which starts the Firestore and Auth emulators.
 *
 * Serial by design — the suites share one emulator database, so parallel
 * workers would clear each other's fixtures mid-test.
 */
export default defineConfig({
  define: {
    // Fake project credentials: the emulator accepts any, and this guarantees
    // the tests can never reach the live project even by misconfiguration.
    'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify('emulator-key'),
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify('lmsironlady-rules-test'),
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify('localhost'),
    'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(''),
    'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(''),
    'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(''),
    'import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY': JSON.stringify(''),
    'import.meta.env.VITE_FIRESTORE_EMULATOR': JSON.stringify('true'),
  },
  test: {
    environment: 'node',
    include: ['rules-test/**/*.test.js'],
    setupFiles: ['rules-test/setup.js'],
    globals: false,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
