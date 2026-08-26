import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { PRODUCTION_PROJECT_ID } from './refuseProduction.js';

/**
 * One staff session opens CX Reviews on staging.
 * Run N copies on separate CI runners (see .github/workflows/load-staff.yml).
 */
const projectId =
  process.env.STAGING_PROJECT_ID ||
  process.env.LOADTEST_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  '';

test.beforeAll(() => {
  if (projectId === PRODUCTION_PROJECT_ID) {
    throw new Error(`Refusing to hit production (${PRODUCTION_PROJECT_ID}).`);
  }
  if (!process.env.STAFF_EMAIL || !process.env.STAFF_PASSWORD) {
    throw new Error('STAFF_EMAIL and STAFF_PASSWORD are required for staging staff concurrency.');
  }
});

test('staging CX reviews loads for one staff session', async ({ page }) => {
  const shard = process.env.STAFF_SHARD_ID || '0';
  const started = Date.now();

  await page.goto('/auth/login');
  await page.getByLabel(/^email$/i).fill(process.env.STAFF_EMAIL);
  await page.getByLabel(/^password$/i).fill(process.env.STAFF_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(app|cx|portal|admin)/, { timeout: 60_000 });
  const signedIn = Date.now();

  await page.goto('/cx/reviews');
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.dashboard-skeleton, .cx-kpi--skeleton').length === 0 &&
      document.querySelector('.cx-review-list, .empty-state, .alert-error') !== null,
    undefined,
    { timeout: 180_000, polling: 200 }
  );

  const crashed = await page
    .getByText(/this page hit an error/i)
    .first()
    .isVisible()
    .catch(() => false);
  expect(crashed, 'reviews must not show the error boundary').toBe(false);

  const screenMs = Date.now() - signedIn;
  const totalMs = Date.now() - started;
  const row = {
    shard,
    projectId: projectId || 'unknown',
    ok: true,
    signInMs: signedIn - started,
    screenMs,
    totalMs,
    at: new Date().toISOString(),
  };

  mkdirSync('test-results', { recursive: true });
  writeFileSync(`test-results/staff-result-${shard}.json`, JSON.stringify(row, null, 2));
  console.log('STAFF_SHARD:' + JSON.stringify(row));

  expect(row.ok).toBe(true);
});
