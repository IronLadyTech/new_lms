/**
 * Competitive UX crawl for tai.thetapacademy.com
 * Credentials via env: TAI_EMAIL, TAI_PASSWORD
 * Usage (PowerShell):
 *   $env:TAI_EMAIL="..."; $env:TAI_PASSWORD="..."; node docs/competitive/tap-academy/crawl-tai.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;
const SHOT_DIR = path.join(OUT_DIR, 'screenshots');
const BASE = 'https://tai.thetapacademy.com';
const EMAIL = process.env.TAI_EMAIL;
const PASSWORD = process.env.TAI_PASSWORD;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 768, height: 900 },
  { width: 390, height: 844 },
];

const DIRECT_ROUTES = [
  { path: '/', slug: 'home' },
  { path: '/courses', slug: 'courses' },
  { path: '/tests', slug: 'tests' },
  { path: '/assignments', slug: 'assignments' },
  { path: '/company-questions', slug: 'company-questions' },
  { path: '/jobs', slug: 'jobs' },
  { path: '/bookmarks', slug: 'bookmarks' },
  { path: '/ask-tai', slug: 'ask-tai' },
  { path: '/chat', slug: 'chat' },
  { path: '/profile', slug: 'profile' },
  { path: '/settings', slug: 'settings' },
  { path: '/streak', slug: 'streak' },
  { path: '/leaderboard', slug: 'leaderboard' },
  { path: '/placement', slug: 'placement' },
  { path: '/dashboard', slug: 'dashboard' },
];

const CLICK_NAV = [
  { label: 'Dashboard', slug: 'nav-dashboard' },
  { label: 'Courses', slug: 'nav-courses' },
  { label: 'Tests', slug: 'nav-tests' },
  { label: 'Assignments', slug: 'nav-assignments' },
  { label: 'Company Questions', slug: 'nav-company-questions' },
  { label: 'Jobs', slug: 'nav-jobs' },
  { label: 'Bookmarks', slug: 'nav-bookmarks' },
  { label: 'Ask TAI', slug: 'nav-ask-tai' },
  { label: 'Profile', slug: 'nav-profile' },
];

function absUrl(route) {
  if (route.startsWith('http')) return route;
  return `${BASE}${route.startsWith('/') ? route : '/' + route}`;
}

function slugFromPath(p) {
  let s = (p || '/').replace(BASE, '');
  try {
    if (s.startsWith('http')) s = new URL(s).pathname;
  } catch {}
  s = s.replace(/\/+/g, '/').replace(/\/$/, '') || 'home';
  if (s === '/') return 'home';
  return s
    .replace(/^\//, '')
    .replace(/\//g, '__')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);
}

async function dismissNoise(page) {
  for (const sel of [
    'button:has-text("Accept")',
    'button:has-text("Got it")',
    'button:has-text("Close")',
    '[aria-label="Close"]',
  ]) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 })) await el.click({ timeout: 800 });
    } catch {}
  }
}

async function settle(page, ms = 2000) {
  await page.waitForTimeout(ms);
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {}
  await dismissNoise(page);
}

async function extractPageNotes(page, url) {
  const notes = {
    url,
    finalUrl: page.url(),
    title: '',
    headings: [],
    navLabels: [],
    uiStates: [],
    bodySample: '',
    brandColors: {},
    linksDiscovered: [],
    interactiveNav: [],
    error: null,
  };
  try {
    notes.title = await page.title();
    const data = await page.evaluate((base) => {
      const headings = [];
      document.querySelectorAll('h1,h2,h3,[role="heading"]').forEach((el) => {
        const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
        if (t && t.length < 200) headings.push({ tag: el.tagName.toLowerCase(), text: t });
      });

      const navLabels = new Set();
      const interactiveNav = [];
      const navSels = [
        'nav a', 'aside a', '[role="navigation"] a', 'header a',
        'nav button', 'aside button', '[role="navigation"] button',
        '[class*="menu"] a', '[class*="Menu"] a', '[class*="sidebar"] a',
        '[class*="Sidebar"] a', '[class*="nav"] a', '[class*="Nav"] a',
      ];
      for (const s of navSels) {
        document.querySelectorAll(s).forEach((el) => {
          const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
          if (t && t.length < 80) navLabels.add(t);
        });
      }
      // Sidebar text items that look like nav (MENU section)
      const bodyText = document.body?.innerText || '';
      const known = [
        'Dashboard', 'Courses', 'Tests', 'Assignments', 'Company Questions',
        'Jobs', 'Bookmarks', 'Ask TAI', 'Profile', 'Settings', 'Leaderboard',
        'Placement', 'Streak',
      ];
      for (const k of known) {
        if (bodyText.includes(k)) navLabels.add(k);
      }

      // clickable elements with those labels
      document.querySelectorAll('a, button, [role="button"], [role="link"]').forEach((el) => {
        const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
        if (known.some((k) => t === k || t.startsWith(k))) {
          interactiveNav.push({
            text: t.slice(0, 80),
            tag: el.tagName.toLowerCase(),
            href: el.getAttribute('href') || null,
          });
        }
      });

      const states = [];
      const lower = bodyText.toLowerCase();
      const checks = [
        ['empty', /no (data|courses|items|results|bookmarks)|nothing here|empty|no practice yet/i],
        ['locked', /locked|unlock|premium|subscribe|enroll to access/i],
        ['loading', /loading\.\.\.|please wait/i],
        ['completed', /completed|100%|finished/i],
        ['progress', /\d+%/],
        ['error', /something went wrong|unauthorized|forbidden|page not found|404/i],
      ];
      for (const [name, re] of checks) {
        if (re.test(bodyText)) states.push(name);
      }
      if (document.querySelector('[aria-busy="true"], .spinner, .loading, [class*="skeleton"]')) {
        states.push('loading-indicator');
      }
      if (document.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="player"]')) {
        states.push('video-player');
      }
      if (document.querySelector('.monaco-editor, .CodeMirror, [class*="ace_editor"]')) {
        states.push('code-editor');
      }

      const pick = (el) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          color: cs.color,
          background: cs.backgroundColor,
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
        };
      };
      const btn =
        document.querySelector('button[type="submit"], button.primary, .btn-primary') ||
        document.querySelector('button');
      const link = document.querySelector('a[href]:not([href="#"])');
      const r = getComputedStyle(document.documentElement);
      const cssVars = {};
      for (const k of ['--primary', '--secondary', '--accent', '--brand', '--color-primary', '--main']) {
        const v = r.getPropertyValue(k).trim();
        if (v) cssVars[k] = v;
      }

      const links = [];
      const seen = new Set();
      document.querySelectorAll('a[href]').forEach((a) => {
        try {
          const href = a.getAttribute('href');
          if (!href || href.startsWith('javascript:') || href === '#') return;
          const abs = new URL(href, base).href;
          if (!abs.startsWith(base)) return;
          const path = abs.replace(base, '') || '/';
          if (seen.has(path)) return;
          seen.add(path);
          links.push({
            href: path,
            label: (a.innerText || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 80),
          });
        } catch {}
      });

      return {
        headings: headings.slice(0, 40),
        navLabels: [...navLabels].slice(0, 60),
        interactiveNav: interactiveNav.slice(0, 40),
        uiStates: [...new Set(states)],
        bodySample: bodyText.replace(/\s+/g, ' ').trim().slice(0, 2000),
        brandColors: {
          body: pick(document.body),
          header: pick(document.querySelector('header, nav, [class*="Header"]')),
          button: pick(btn),
          link: pick(link),
          cssVars,
        },
        linksDiscovered: links.slice(0, 100),
      };
    }, BASE);
    Object.assign(notes, data);
  } catch (e) {
    notes.error = String(e?.message || e);
  }
  return notes;
}

async function screenshotPage(page, name) {
  const files = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(500);
    // open mobile menu if present for small width
    if (vp.width <= 390) {
      try {
        const menu = page.locator('text=MENU, button:has-text("MENU"), [aria-label*="menu" i]').first();
        if (await menu.isVisible({ timeout: 600 })) {
          await menu.click();
          await page.waitForTimeout(400);
        }
      } catch {}
    }
    const file = path.join(SHOT_DIR, `${name}-${vp.width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    files.push(path.relative(OUT_DIR, file).replace(/\\/g, '/'));
  }
  // restore desktop for next nav
  await page.setViewportSize(VIEWPORTS[0]);
  await page.waitForTimeout(200);
  return files;
}

async function login(page) {
  await page.goto(`${BASE}/loginEmail`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 1500);

  const email = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').first();
  const pass = page.locator('input[type="password"]').first();
  if (await email.count()) await email.fill(EMAIL);
  else {
    const inputs = page.locator('input:not([type="hidden"]):not([type="password"])');
    if (await inputs.count()) await inputs.first().fill(EMAIL);
  }
  if (await pass.count()) await pass.fill(PASSWORD);

  const submit = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Log in"), button:has-text("Sign in")').first();
  if (await submit.count()) await submit.click();
  else await page.keyboard.press('Enter');

  await settle(page, 3000);
  try {
    await page.waitForURL((u) => !/login/i.test(u.pathname), { timeout: 25000 });
  } catch {}
  await settle(page, 2000);
  return page.url();
}

async function tryLogout(page) {
  const candidates = [
    'text=Logout',
    'text=Log out',
    'text=Sign out',
    'button:has-text("Logout")',
    'a:has-text("Logout")',
  ];
  for (const s of candidates) {
    try {
      const el = page.locator(s).first();
      if (await el.isVisible({ timeout: 800 })) {
        await el.click();
        await settle(page, 1500);
        return true;
      }
    } catch {}
  }
  try {
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1500);
    for (const s of candidates) {
      const el = page.locator(s).first();
      if (await el.isVisible({ timeout: 800 })) {
        await el.click();
        await settle(page, 1500);
        return true;
      }
    }
  } catch {}
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  return false;
}

async function visitAndCapture(page, route, slug, allNotes, allShots, routeMap) {
  const url = absUrl(route);
  console.log(`Direct: ${url} -> ${slug}`);
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await settle(page, 2500);
    const status = resp?.status?.() ?? null;
    routeMap.push({
      mode: 'direct',
      requested: route,
      final: page.url().replace(BASE, '') || '/',
      status,
      slug,
    });
    const notes = await extractPageNotes(page, url);
    notes.slug = slug;
    notes.httpStatus = status;
    allNotes.pages.push(notes);
    const files = await screenshotPage(page, slug);
    allShots.push(...files);
    return notes;
  } catch (e) {
    console.log(`  fail: ${e.message}`);
    routeMap.push({ mode: 'direct', requested: route, error: e.message, slug });
    allNotes.pages.push({ url, error: e.message, slug });
    return null;
  }
}

async function clickNavAndCapture(page, label, slug, allNotes, allShots, routeMap) {
  console.log(`Click-nav: ${label} -> ${slug}`);
  try {
    await page.setViewportSize(VIEWPORTS[0]);
    // Ensure menu open on desktop if needed
    const menuBtn = page.locator('text=MENU').first();
    try {
      if (await menuBtn.isVisible({ timeout: 500 })) await menuBtn.click();
    } catch {}

    const link = page
      .locator(
        `nav >> text="${label}", aside >> text="${label}", [role="navigation"] >> text="${label}", a:has-text("${label}"), button:has-text("${label}"), [role="button"]:has-text("${label}"), [role="link"]:has-text("${label}")`
      )
      .first();

    // Playwright doesn't support comma that way for multiple - use getByRole / getByText
    let target = page.getByRole('link', { name: label, exact: true });
    if (!(await target.count())) target = page.getByRole('button', { name: label, exact: true });
    if (!(await target.count())) target = page.getByText(label, { exact: true });

    const el = target.first();
    if (!(await el.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`  skip (not visible): ${label}`);
      routeMap.push({ mode: 'click', requested: label, skipped: true, slug });
      return null;
    }
    await el.click({ timeout: 5000 });
    await settle(page, 2500);
    routeMap.push({
      mode: 'click',
      requested: label,
      final: page.url().replace(BASE, '') || '/',
      slug,
    });
    const notes = await extractPageNotes(page, page.url());
    notes.slug = slug;
    allNotes.pages.push(notes);
    const files = await screenshotPage(page, slug);
    allShots.push(...files);
    return notes;
  } catch (e) {
    console.log(`  click fail: ${e.message}`);
    routeMap.push({ mode: 'click', requested: label, error: e.message, slug });
    return null;
  }
}

async function openCourseDeepDive(page, allNotes, allShots, routeMap) {
  const result = { course: null, lesson: null, ide: null };
  try {
    await page.goto(`${BASE}/courses`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await settle(page, 2500);

    // Prefer course cards with href
    let courseLink = page.locator('a[href*="/courses/"]').first();
    if (!(await courseLink.count())) {
      courseLink = page.locator('a[href*="/course"]').first();
    }
    if (await courseLink.count()) {
      const href = await courseLink.getAttribute('href');
      console.log('Opening course:', href);
      await courseLink.click();
      await settle(page, 3000);
      result.course = page.url();
      routeMap.push({ mode: 'deep', requested: 'course', final: page.url().replace(BASE, ''), slug: 'course-detail' });
      const notes = await extractPageNotes(page, page.url());
      notes.slug = 'course-detail';
      allNotes.pages.push(notes);
      allShots.push(...(await screenshotPage(page, 'course-detail')));

      // Expand modules / find lesson
      for (const expand of ['text=/module|chapter|section|week/i', '[class*="accordion"]', '[class*="expand"]']) {
        try {
          const e = page.locator(expand).first();
          if (await e.isVisible({ timeout: 800 })) await e.click();
        } catch {}
      }
      await settle(page, 1000);

      const lessonCandidates = [
        'a[href*="/lesson"]',
        'a[href*="/video"]',
        'a[href*="/topic"]',
        'a[href*="/content"]',
        'a[href*="/courses/"][href*="/"]',
        'text=/watch|start|continue|play|lesson/i',
      ];
      let opened = false;
      for (const sel of lessonCandidates) {
        try {
          const loc = page.locator(sel).first();
          if (await loc.isVisible({ timeout: 1000 })) {
            console.log('Opening lesson via', sel);
            await loc.click();
            await settle(page, 3500);
            opened = true;
            break;
          }
        } catch {}
      }
      if (opened) {
        result.lesson = page.url();
        routeMap.push({ mode: 'deep', requested: 'lesson', final: page.url().replace(BASE, ''), slug: 'lesson-detail' });
        const ln = await extractPageNotes(page, page.url());
        ln.slug = 'lesson-detail';
        allNotes.pages.push(ln);
        allShots.push(...(await screenshotPage(page, 'lesson-detail')));

        // IDE / practice
        const ideSels = [
          page.getByRole('button', { name: /practice|code|compiler|ide|editor/i }),
          page.getByRole('link', { name: /practice|code|compiler|ide/i }),
          page.locator('a[href*="practice"], a[href*="ide"], a[href*="compiler"]'),
        ];
        for (const loc of ideSels) {
          try {
            if (await loc.first().isVisible({ timeout: 1000 })) {
              await loc.first().click();
              await settle(page, 3000);
              result.ide = page.url();
              break;
            }
          } catch {}
        }
        const hasEditor = await page.evaluate(
          () => !!document.querySelector('.monaco-editor, .CodeMirror, [class*="ace_editor"], textarea')
        );
        if (result.ide || hasEditor) {
          const slug = 'code-practice-ide';
          routeMap.push({ mode: 'deep', requested: 'ide', final: page.url().replace(BASE, ''), slug });
          const ideNotes = await extractPageNotes(page, page.url());
          ideNotes.slug = slug;
          if (hasEditor) ideNotes.uiStates = [...new Set([...(ideNotes.uiStates || []), 'code-editor'])];
          allNotes.pages.push(ideNotes);
          allShots.push(...(await screenshotPage(page, slug)));
          if (!result.ide) result.ide = page.url();
        }
      } else {
        console.log('No lesson link found');
      }
    } else {
      console.log('No course link on /courses');
    }
  } catch (e) {
    console.log('Deep dive error:', e.message);
    allNotes.deepDiveError = e.message;
  }
  allNotes.deepDive = result;
  return result;
}

async function discoverExtraRoutes(page, allNotes) {
  // From home body + links
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  const notes = await extractPageNotes(page, `${BASE}/`);
  const paths = new Set((notes.linksDiscovered || []).map((l) => l.href));
  // Heuristic paths from body CTAs
  const extras = [];
  const body = notes.bodySample || '';
  if (/placement/i.test(body)) extras.push({ path: '/placement', slug: 'placement-extra' });
  if (/leaderboard/i.test(body)) extras.push({ path: '/leaderboard', slug: 'leaderboard-extra' });
  allNotes.discoveredRoutes = [...paths];
  allNotes.homeNavLabels = notes.navLabels;
  return { paths: [...paths], extras, homeNotes: notes };
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Set TAI_EMAIL and TAI_PASSWORD env vars');
    process.exit(1);
  }
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  // clear old screenshots
  for (const f of fs.readdirSync(SHOT_DIR)) {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOT_DIR, f));
  }

  const allNotes = {
    crawledAt: new Date().toISOString(),
    base: BASE,
    pages: [],
    teardown: {},
    discoveredRoutes: [],
    deepDive: null,
  };
  const allShots = [];
  const routeMap = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true,
    viewport: VIEWPORTS[0],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  console.log('Logging in...');
  const afterLogin = await login(page);
  console.log('After login:', afterLogin.replace(BASE, '') || '/');
  allNotes.loginLanding = afterLogin.replace(BASE, '') || '/';

  const disc = await discoverExtraRoutes(page, allNotes);
  console.log('Discovered hrefs:', disc.paths.slice(0, 40).join(', ') || '(none)');
  console.log('Nav labels:', (allNotes.homeNavLabels || []).join(', '));

  // Direct routes
  for (const r of DIRECT_ROUTES) {
    await visitAndCapture(page, r.path, r.slug, allNotes, allShots, routeMap);
  }

  // Extra discovered deep paths (first-level only)
  for (const p of disc.paths) {
    if (!p || p === '/') continue;
    if (p.split('/').filter(Boolean).length > 2) continue;
    if (DIRECT_ROUTES.some((d) => d.path === p)) continue;
    if (/login|logout|signup|register/i.test(p)) continue;
    const slug = 'disc-' + slugFromPath(p);
    await visitAndCapture(page, p, slug, allNotes, allShots, routeMap);
  }

  // Click-nav from home
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  for (const item of CLICK_NAV) {
    await clickNavAndCapture(page, item.label, item.slug, allNotes, allShots, routeMap);
    // return home for next click reliability
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
  }

  await openCourseDeepDive(page, allNotes, allShots, routeMap);

  // Aggregate teardown
  const allNav = new Set();
  const colorSamples = [];
  for (const p of allNotes.pages) {
    (p.navLabels || []).forEach((n) => allNav.add(n));
    if (p.brandColors) colorSamples.push({ slug: p.slug, ...p.brandColors });
  }
  allNotes.teardown = {
    layout:
      'App shell with left/hamburger MENU sidebar + main dashboard content. Home shows My Learning, streak calendar, placement widgets. Course detail is a nested route under /courses/:id.',
    nav: [...allNav],
    typography: colorSamples[0]?.body?.fontFamily || null,
    colour: { samples: colorSamples.filter((c) => c.slug === 'home' || c.slug === 'login' || c.slug === 'courses').slice(0, 6) },
    spacing: 'Dense dashboard cards; screenshot comparison at 1440 / 768 / 390.',
    icons: 'Emoji streak flame present in copy; otherwise check screenshots for SVG iconography in MENU.',
    components: [
      'Sidebar MENU',
      'Progress % rings/bars (Courses/Assignments/Tests)',
      'Course cards with Start CTA',
      'Practice streak calendar heatmap',
      'Assignment review cards',
      'Video/lesson player (if opened)',
      'Possible code practice IDE',
    ],
    interactions: [
      'Email/password login at /loginEmail',
      'Direct URL routing for primary sections',
      'Click-nav via MENU labels',
      'Course list -> course detail drill-down',
      'Lesson/video open when links present',
    ],
    breakpoints: ['1440x900', '768x900', '390x844'],
    deepDive: allNotes.deepDive,
    routeMap,
  };
  allNotes.routeMap = routeMap;
  allNotes.screenshotFiles = [...new Set(allShots)];

  console.log('Capturing login screenshots...');
  await tryLogout(page);
  await page.goto(`${BASE}/loginEmail`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 2000);
  const loginNotes = await extractPageNotes(page, `${BASE}/loginEmail`);
  loginNotes.slug = 'login';
  allNotes.pages.push(loginNotes);
  allShots.push(...(await screenshotPage(page, 'login')));
  allNotes.screenshotFiles = [...new Set(allShots)];

  const notesPath = path.join(OUT_DIR, 'crawl-notes.json');
  let json = JSON.stringify(allNotes, null, 2);
  if (PASSWORD) {
    json = json.split(PASSWORD).join('[REDACTED]');
  }
  fs.writeFileSync(notesPath, json, 'utf8');
  console.log('Wrote', notesPath);
  console.log('Screenshots:', allNotes.screenshotFiles.length);
  console.log('Files:', allNotes.screenshotFiles.join('\n'));
  console.log('DONE');
  await browser.close();
}

main().catch((e) => {
  console.error('CRAWL_FAILED', e.message);
  process.exit(1);
});
