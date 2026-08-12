import { test, expect } from '@playwright/test';

/**
 * The learner site under load.
 *
 * Two separate questions, often confused:
 *   1. does a learner's own experience slow down as the cohort grows, and
 *   2. what happens when many learners are on the site at the same time.
 *
 * The staff load test answered neither — it measured staff screens against a
 * large roster. This measures the site the learners actually use.
 */

const PASSWORD = 'load-learner-pw-1';
const learnerEmail = (i) => `loadlearner${i}@example.com`;

async function signIn(page, email) {
  await page.goto('/auth/login');
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(app|cx|portal|admin)/, { timeout: 60_000 });
}

const SKELETON = '.dashboard-skeleton, .cx-kpi--skeleton';

const SCREENS = [
  { name: 'Learner — home', path: '/app/home', content: '.course-grid, .empty-state' },
  {
    name: 'Learner — MBW',
    path: '/app/mbw',
    content: '.mbw-lesson-row, .mbw-section-card, .empty-state',
  },
  {
    name: 'Learner — 100BM',
    path: '/app/100bm',
    content: '.mbw-section-card, .mbw-lesson-row, .empty-state',
  },
  {
    name: 'Learner — progress',
    path: '/app/progress',
    content: '.section-card, .course-progress-ring, .empty-state',
  },
  {
    name: 'Learner — calendar',
    path: '/app/calendar',
    content: '.event-calendar__day, .empty-state',
  },
];

/** Waits until the screen has real content and nothing is still loading. */
async function waitUsable(page, content) {
  try {
    await page.waitForFunction(
      ([skeleton, sel]) =>
        document.querySelectorAll(skeleton).length === 0 && document.querySelector(sel) !== null,
      [SKELETON, content],
      { timeout: 90_000, polling: 100 }
    );
    return false;
  } catch {
    return true;
  }
}

test('a learner’s own screens', async ({ browser }) => {
  test.setTimeout(600_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  let reads = { requests: 0, bytes: 0 };
  const seen = new Set();
  cdp.on('Network.requestWillBeSent', (e) => {
    if (e.request.url.includes(':8080')) {
      seen.add(e.requestId);
      reads.requests += 1;
    }
  });
  cdp.on('Network.loadingFinished', (e) => {
    if (seen.has(e.requestId)) reads.bytes += e.encodedDataLength || 0;
  });

  await signIn(page, learnerEmail(0));

  const rows = [];
  for (const screen of SCREENS) {
    await page.goto('about:blank');
    reads = { requests: 0, bytes: 0 };
    seen.clear();

    const started = Date.now();
    await page.goto(screen.path);
    const timedOut = await waitUsable(page, screen.content);
    const usableMs = Date.now() - started;

    const crashed = await page
      .getByText(/this page hit an error/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(crashed, `${screen.name} rendered its error boundary`).toBe(false);

    const nodes = await page.evaluate(() => document.querySelectorAll('*').length);
    rows.push({ screen: screen.name, usableMs, timedOut, nodes, ...reads });
  }

  await ctx.close();
  console.log('LEARNERSTATS:' + JSON.stringify(rows));
});

test('many learners at once', async ({ browser }) => {
  test.setTimeout(900_000);
  const CONCURRENCY = Number(process.env.LEARNER_CONCURRENCY || 10);

  const run = async (i) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const started = Date.now();
    try {
      await signIn(page, learnerEmail(i));
      const signedIn = Date.now() - started;
      await page.goto('/app/home');
      const timedOut = await waitUsable(page, '.course-grid, .empty-state');
      return { i, signInMs: signedIn, totalMs: Date.now() - started, ok: !timedOut };
    } catch (err) {
      return { i, totalMs: Date.now() - started, ok: false, err: String(err).slice(0, 70) };
    } finally {
      await ctx.close();
    }
  };

  const results = await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => run(i)));
  const ok = results.filter((r) => r.ok);
  const times = ok.map((r) => r.totalMs).sort((a, b) => a - b);
  console.log(
    'LEARNERCONCURRENCY:' +
      JSON.stringify({
        concurrency: CONCURRENCY,
        succeeded: ok.length,
        medianMs: times[Math.floor(times.length / 2)] ?? null,
        slowestMs: times[times.length - 1] ?? null,
        failures: results.filter((r) => !r.ok),
      })
  );
  expect(ok.length).toBe(CONCURRENCY);
});
