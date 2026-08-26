import { defineConfig } from '@playwright/test';
import { PRODUCTION_PROJECT_ID } from './load-test/refuseProduction.js';

/**
 * Staff concurrency against a **staging** deploy (or preview built with staging env).
 * One worker per GitHub Actions job; matrix shards provide true multi-machine load.
 *
 * Never points at production: refuses if STAGING_PROJECT_ID / VITE_FIREBASE_PROJECT_ID
 * is lmsironlady.
 */
const projectId =
  process.env.STAGING_PROJECT_ID ||
  process.env.LOADTEST_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  '';

if (projectId === PRODUCTION_PROJECT_ID) {
  throw new Error(
    `Refusing staging-load config: project id is production (${PRODUCTION_PROJECT_ID}).`
  );
}

const baseURL = process.env.STAGING_BASE_URL || 'http://127.0.0.1:4175';

export default defineConfig({
  testDir: 'load-test',
  testMatch: /staffConcurrency\.staging\.spec\.js/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/staff-shard.json' }]],
  timeout: 300_000,
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
});
