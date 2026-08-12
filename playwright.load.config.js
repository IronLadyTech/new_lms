import { defineConfig } from '@playwright/test';

/**
 * Load characterisation, kept out of the main e2e run because it needs a seeded
 * emulator and takes minutes rather than seconds.
 *
 * The preview server is built with VITE_FIRESTORE_EMULATOR=true, so the app
 * under test talks to 127.0.0.1 and can never reach the live project.
 */
export default defineConfig({
  testDir: 'load-test',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 600_000,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
