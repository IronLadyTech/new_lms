import { test, expect } from '@playwright/test';

/**
 * Performance characterisation with repeat runs.
 *
 * The earlier load tests took a single sample per screen, which is enough to
 * spot a screen that is catastrophically slow but not enough to report as a
 * result: one sample has no average, no worst case, and no way to tell a real
 * regression from noise. This runs each screen repeatedly and reports the
 * spread, separating time spent waiting on the database from total time to a
 * usable screen.
 */

const ITERATIONS = Number(process.env.PERF_ITERATIONS || 5);

/**
 * Thresholds, from Nielsen's response-time limits.
 *
 * 1s is the limit for a user's train of thought to stay uninterrupted; 10s is
 * the limit for keeping their attention at all. A staff screen sits between the
 * two, so 3s is the target and 10s is the point at which the screen has failed
 * its purpose rather than merely feeling slow.
 */
const PASS_MS = 3000;
const FAIL_MS = 10000;

const STAFF = { email: 'load-admin@example.com', password: 'load-test-pw-1' };
const LEARNER = { email: 'loadlearner0@example.com', password: 'load-learner-pw-1' };

const SKELETON = '.dashboard-skeleton, .cx-kpi--skeleton';

const SCREENS = [
  {
    name: 'Admin — users',
    role: 'staff',
    path: '/admin?section=users',
    content: '.admin-list, table, input[type="search"]',
  },
  {
    name: 'Admin — overview',
    role: 'staff',
    path: '/admin?section=overview',
    content: '.stat-card',
  },
  {
    name: 'CX — home',
    role: 'staff',
    path: '/cx/home',
    content: '.cx-kpi__value, .cx-attention-cards, .empty-state',
  },
  {
    name: 'CX — reviews',
    role: 'staff',
    path: '/cx/reviews',
    content: '.cx-review-list, .empty-state',
  },
  {
    name: 'CX — batches',
    role: 'staff',
    path: '/cx/batches',
    content: '.cx-batches-page .cx-panel__body',
  },
  {
    name: 'CX — analytics',
    role: 'staff',
    path: '/cx/dashboards',
    content: '.cx-kpi__value, .recharts-wrapper, .empty-state',
  },
  { name: 'Learner — home', role: 'learner', path: '/app/home', content: '.course-grid' },
  {
    name: 'Learner — MBW',
    role: 'learner',
    path: '/app/mbw',
    content: '.mbw-lesson-row, .mbw-section-card, .empty-state',
  },
  {
    name: 'Learner — progress',
    role: 'learner',
    path: '/app/progress',
    content: '.section-card, .course-progress-ring, .empty-state',
  },
];

async function signIn(page, { email, password }) {
  await page.goto('/auth/login');
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(app|cx|portal|admin)/, { timeout: 60_000 });
}

const stat = (xs, pick) => (xs.length ? Math.round(pick(xs)) : null);
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** One screen, sampled ITERATIONS times. */
async function measureScreen(page, cdp, screen) {
  const totals = [];
  const apis = [];
  const sizes = [];
  const counts = [];

  for (let i = 0; i < ITERATIONS; i++) {
    // A fresh page each time, so nothing is answered from a warm React tree.
    await page.goto('about:blank');

    let firstReq = null;
    let lastResp = null;
    let bytes = 0;
    let requests = 0;
    const tracked = new Set();

    const onSent = (e) => {
      if (!e.request.url.includes(':8080')) return;
      tracked.add(e.requestId);
      requests += 1;
      if (firstReq === null) firstReq = Date.now();
    };
    const onDone = (e) => {
      if (!tracked.has(e.requestId)) return;
      bytes += e.encodedDataLength || 0;
      lastResp = Date.now();
    };
    cdp.on('Network.requestWillBeSent', onSent);
    cdp.on('Network.loadingFinished', onDone);

    const started = Date.now();
    await page.goto(screen.path);
    await page.waitForFunction(
      ([skeleton, sel]) =>
        document.querySelectorAll(skeleton).length === 0 && document.querySelector(sel) !== null,
      [SKELETON, screen.content],
      { timeout: 120_000, polling: 100 }
    );
    totals.push(Date.now() - started);

    cdp.off('Network.requestWillBeSent', onSent);
    cdp.off('Network.loadingFinished', onDone);

    // Database time: first query issued to last response received.
    if (firstReq !== null && lastResp !== null) apis.push(lastResp - firstReq);
    sizes.push(bytes / 1024);
    counts.push(requests);
  }

  const worst = Math.max(...totals);
  return {
    screen: screen.name,
    role: screen.role,
    runs: ITERATIONS,
    avgMs: stat(totals, avg),
    maxMs: worst,
    minMs: Math.min(...totals),
    apiAvgMs: stat(apis, avg),
    apiMaxMs: apis.length ? Math.max(...apis) : null,
    dataKB: Math.round(avg(sizes) * 10) / 10,
    requests: Math.round(avg(counts)),
    // Judged on the worst run, not the average — the worst is what a user meets.
    verdict: worst <= PASS_MS ? 'PASS' : worst <= FAIL_MS ? 'CONCERN' : 'FAIL',
  };
}

test('response times across staff and learner screens', async ({ browser }) => {
  test.setTimeout(1_800_000);
  const results = [];

  for (const role of ['staff', 'learner']) {
    const screens = SCREENS.filter((s) => s.role === role);
    if (!screens.length) continue;

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');

    await signIn(page, role === 'staff' ? STAFF : LEARNER);
    for (const screen of screens) {
      results.push(await measureScreen(page, cdp, screen));
    }
    await ctx.close();
  }

  console.log('PERF:' + JSON.stringify(results, null, 1));
  const failures = results.filter((r) => r.verdict === 'FAIL');
  console.log('PERFSUMMARY:' + JSON.stringify({ total: results.length, failed: failures.length }));
  expect(results.length).toBe(SCREENS.length);
});
