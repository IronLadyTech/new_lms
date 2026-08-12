import { test, expect } from '@playwright/test';

/**
 * Load and volume characterisation (OPS-02).
 *
 * Answers three questions the product had no answer to:
 *   1. does each screen stay usable as the learner base grows,
 *   2. how many database reads does a screen cost — which is the bill, and
 *   3. does anything degrade when several staff use it at once.
 *
 * Runs against the emulator with seeded data. It never touches the live
 * project: the app is pointed at 127.0.0.1 by VITE_FIRESTORE_EMULATOR.
 */

const STAFF = { email: 'load-admin@example.com', password: 'load-test-pw-1' };

async function signInAsStaff(page) {
  await page.goto('/auth/login');
  await page.getByLabel(/^email$/i).fill(STAFF.email);
  await page.getByLabel(/^password$/i).fill(STAFF.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(app|cx|portal|admin)/, { timeout: 45_000 });
}

/**
 * Measures Firestore traffic through CDP.
 *
 * Reading response bodies off the Playwright event does not work here: the
 * Firestore SDK streams over a long-lived channel, so bodies are unavailable
 * and byte totals come back as noise. `Network.loadingFinished` reports the
 * encoded length the browser actually received, which is the real wire cost.
 */
async function trackFirestore(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  const stats = { requests: 0, bytes: 0 };
  const firestoreRequests = new Set();

  cdp.on('Network.requestWillBeSent', (e) => {
    if (e.request.url.includes(':8080') || e.request.url.includes('firestore')) {
      firestoreRequests.add(e.requestId);
      stats.requests += 1;
    }
  });
  cdp.on('Network.loadingFinished', (e) => {
    if (firestoreRequests.has(e.requestId)) stats.bytes += e.encodedDataLength || 0;
  });

  return {
    read: () => ({ ...stats }),
    reset: () => {
      stats.requests = 0;
      stats.bytes = 0;
      firestoreRequests.clear();
    },
    dispose: () => cdp.detach().catch(() => {}),
  };
}

/**
 * Each screen names the element that only exists once its data has arrived.
 *
 * Waiting on a spinner to disappear is not enough — when a screen never renders
 * one, the wait passes instantly and the page is measured before it has drawn
 * anything, which is what made the first run's admin numbers jump around.
 */
const SCREENS = [
  {
    name: 'Admin — users',
    path: '/admin?section=users',
    ready: '.admin-shell',
    content: '.admin-list, table, input[type="search"]',
  },
  {
    name: 'Admin — overview',
    path: '/admin?section=overview',
    ready: '.admin-shell',
    content: '.stat-card',
  },
  {
    name: 'CX — home',
    path: '/cx/home',
    ready: '.bottom-nav',
    content: '.cx-kpi__value, .cx-attention-cards, .empty-state',
  },
  {
    name: 'CX — analytics',
    path: '/cx/dashboards',
    ready: '.bottom-nav',
    content: '.cx-kpi__value, .recharts-wrapper, .empty-state',
  },
  {
    name: 'CX — reviews',
    path: '/cx/reviews',
    ready: '.bottom-nav',
    content: '.cx-review-list, .empty-state',
  },
  {
    name: 'CX — batches',
    path: '/cx/batches',
    ready: '.bottom-nav',
    content: '.cx-batches-page .cx-panel__body',
  },
];

/** While any of these are on the page, the screen is still loading. */
const SKELETON = '.dashboard-skeleton, .cx-kpi--skeleton';

test('screen timing and database cost at volume', async ({ browser }) => {
  test.setTimeout(600_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await signInAsStaff(page);

  const tracker = await trackFirestore(page);
  const rows = [];
  for (const screen of SCREENS) {
    await page.goto('about:blank');
    tracker.reset();
    const started = Date.now();

    await page.goto(screen.path);
    await page.locator(screen.ready).first().waitFor({ state: 'visible', timeout: 90_000 });
    /*
     * Usable means the skeletons are gone AND real content has been painted.
     * Either half alone is misleading: a shell renders instantly, and some
     * screens never show a spinner at all.
     */
    let timedOut = false;
    try {
      await page.waitForFunction(
        ([skeleton, content]) =>
          document.querySelectorAll(skeleton).length === 0 &&
          document.querySelector(content) !== null,
        [SKELETON, screen.content],
        { timeout: 90_000, polling: 100 }
      );
    } catch {
      timedOut = true;
    }
    const usableMs = Date.now() - started;
    const stats = tracker.read();

    // How much is actually on screen, and does the browser still respond?
    const detail = await page.evaluate(() => {
      const t0 = performance.now();
      document.body.getBoundingClientRect();
      return {
        nodes: document.querySelectorAll('*').length,
        rows: document.querySelectorAll('.admin-list li, .cx-review-list-item, tbody tr').length,
        layoutMs: Math.round(performance.now() - t0),
      };
    });

    rows.push({ screen: screen.name, usableMs, timedOut, ...detail, ...stats });
  }

  tracker.dispose();
  await ctx.close();
  console.log('LOADSTATS:' + JSON.stringify(rows));
  expect(rows.length).toBe(SCREENS.length);
});

test('concurrent staff sessions', async ({ browser }) => {
  test.setTimeout(600_000);
  const CONCURRENCY = 8;

  const run = async (i) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const started = Date.now();
    try {
      await signInAsStaff(page);
      // The reviews queue, because it is the heaviest screen staff actually use.
      await page.goto('/cx/reviews');
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.dashboard-skeleton, .cx-kpi--skeleton').length === 0 &&
          document.querySelector('.cx-review-list, .empty-state') !== null,
        undefined,
        { timeout: 180_000, polling: 200 }
      );
      return { i, ms: Date.now() - started, ok: true };
    } catch (err) {
      return { i, ms: Date.now() - started, ok: false, err: String(err).slice(0, 80) };
    } finally {
      await ctx.close();
    }
  };

  const results = await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => run(i)));
  console.log('CONCURRENCY:' + JSON.stringify(results));
  expect(results.filter((r) => r.ok).length).toBe(CONCURRENCY);
});
