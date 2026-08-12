import { test } from '@playwright/test';

/**
 * The learner dashboard under conditions a learner would recognise.
 *
 * The earlier learner numbers were localhost with a warm cache: no network
 * latency, no download, nothing cold. They measured the database work and
 * nothing else. This measures a first visit on a phone-grade connection, which
 * is what "is 1.1 seconds good" actually depends on.
 */

const PASSWORD = 'load-learner-pw-1';

/** Roughly a mid-range phone on a decent 4G connection. */
const FOUR_G = {
  offline: false,
  latency: 70,
  downloadThroughput: (4 * 1024 * 1024) / 8,
  uploadThroughput: (1 * 1024 * 1024) / 8,
};

test('first visit on a phone connection', async ({ browser }) => {
  test.setTimeout(600_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  // Sign in unthrottled; we are measuring the dashboard, not the login.
  await page.goto('/auth/login');
  await page.getByLabel(/^email$/i).fill('loadlearner0@example.com');
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(app|cx|portal|admin)/, { timeout: 60_000 });

  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');

  let bytes = 0;
  let requests = 0;
  const seen = new Set();
  cdp.on('Network.requestWillBeSent', (e) => {
    seen.add(e.requestId);
    requests += 1;
  });
  cdp.on('Network.loadingFinished', (e) => {
    if (seen.has(e.requestId)) bytes += e.encodedDataLength || 0;
  });

  // Cold: no cached bundle, throttled network, slower processor.
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', FOUR_G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const started = Date.now();
  await page.goto('/app/home');
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.dashboard-skeleton').length === 0 &&
      document.querySelector('.course-grid, .empty-state') !== null,
    undefined,
    { timeout: 180_000, polling: 100 }
  );
  const usableMs = Date.now() - started;

  const paint = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      firstPaintMs: fcp ? Math.round(fcp.startTime) : null,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    };
  });

  console.log(
    'REALISTIC:' +
      JSON.stringify({
        usableMs,
        ...paint,
        requests,
        totalKB: Math.round(bytes / 1024),
      })
  );

  await ctx.close();
});
