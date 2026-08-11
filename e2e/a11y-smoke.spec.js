import { test, expect } from '@playwright/test';
import { scanForViolations, describeViolations } from './axeHelper.js';
import { GUEST_SESSION_KEY } from '../src/utils/guestSession.js';

const PUBLIC_ROUTES = [
  { path: '/auth/login', name: 'login' },
  { path: '/auth/signup', name: 'signup' },
];

/** Every learner route a guest can open. */
const GUEST_ROUTES = [
  { path: '/app/home', name: 'learner home' },
  { path: '/app/progress', name: 'progress' },
  { path: '/app/calendar', name: 'calendar' },
  { path: '/app/profile', name: 'profile' },
  { path: '/app/support', name: 'support' },
  { path: '/app/mbw', name: 'MBW programme' },
  { path: '/app/100bm', name: '100BM programme' },
];

test.describe('Accessibility — public pages', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} has no serious axe violations`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const violations = await scanForViolations(page);
      expect(violations, describeViolations(violations)).toEqual([]);
    });
  }
});

test.describe('Accessibility — signed-in learner shell (guest session)', () => {
  test.beforeEach(async ({ page }) => {
    // Seed the guest flag before any app code runs, so the first render is authenticated.
    await page.addInitScript((key) => {
      window.sessionStorage.setItem(key, '1');
    }, GUEST_SESSION_KEY);
  });

  for (const route of GUEST_ROUTES) {
    test(`${route.name} has no serious axe violations`, async ({ page }) => {
      await page.goto(route.path);
      // The shell is the reliable signal: page bodies vary by locked/unlocked state.
      await expect(page.locator('.bottom-nav')).toBeVisible();

      const violations = await scanForViolations(page);
      expect(violations, describeViolations(violations)).toEqual([]);
    });
  }
});
