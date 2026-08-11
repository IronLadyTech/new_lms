import { defineConfig } from '@playwright/test';
import { STAFF_STATE_PATH } from './e2e/authFixture.js';

const MOBILE = {
  browserName: 'chromium',
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    // Signs in once; the staff project reuses the session rather than each of
    // its 12 tests logging in against the real Firebase project.
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      use: { ...MOBILE },
    },
    {
      name: 'mobile-chrome',
      testIgnore: [/auth\.setup\.js/, /a11y-staff\.spec\.js/],
      use: { ...MOBILE },
    },
    {
      name: 'mobile-chrome-staff',
      testMatch: /a11y-staff\.spec\.js/,
      dependencies: ['setup'],
      use: { ...MOBILE, storageState: STAFF_STATE_PATH },
    },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
