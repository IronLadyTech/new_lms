import { test, expect } from '@playwright/test';
import { scanForViolations, describeViolations } from './axeHelper.js';
import { readStaffCredentials } from './authFixture.js';

/**
 * Accessibility scans for the CX and admin surfaces.
 *
 * These pages need a real session, so they were the last part of the product
 * with no automated coverage at all. Read-only: each test loads a page and
 * analyses the rendered DOM. Nothing is submitted, edited, or deleted.
 *
 * The session comes from the `setup` project via storageState — see
 * playwright.config.js. Skips when credentials are absent so CI stays green
 * without secrets.
 */

const credentials = readStaffCredentials();

/** Every staff route reachable without creating data. */
const STAFF_ROUTES = [
  { path: '/cx/home', name: 'CX home', ready: '.bottom-nav' },
  { path: '/cx/batches', name: 'CX batches', ready: '.bottom-nav' },
  { path: '/cx/reviews', name: 'CX reviews', ready: '.bottom-nav' },
  { path: '/cx/dashboards', name: 'CX analytics', ready: '.bottom-nav' },
  { path: '/cx/profile', name: 'CX profile', ready: '.bottom-nav' },
  { path: '/portal', name: 'portal gate', ready: '.portal-gate' },
  { path: '/admin?section=overview', name: 'admin overview', ready: '.admin-shell' },
  { path: '/admin?section=users', name: 'admin users', ready: '.admin-shell' },
  { path: '/admin?section=access', name: 'admin access requests', ready: '.admin-shell' },
  { path: '/admin?section=tickets', name: 'admin tickets', ready: '.admin-shell' },
  { path: '/admin?section=groups', name: 'admin batches', ready: '.admin-shell' },
  { path: '/admin?section=calendar', name: 'admin calendar', ready: '.admin-shell' },
];

test.describe('Accessibility — staff and admin pages', () => {
  test.skip(!credentials, 'No staff credentials — see e2e/.auth.local.example');
  // Real network round-trips against Firebase, so these are slower than the
  // static learner scans. Deliberately not serial: one failing page must not
  // hide the state of the other eleven.
  test.describe.configure({ timeout: 90_000 });

  for (const route of STAFF_ROUTES) {
    test(`${route.name} has no serious axe violations`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator(route.ready).first()).toBeVisible({ timeout: 30_000 });

      // Wait for loading skeletons to clear rather than guessing at a delay —
      // scanning mid-load reports whatever half-rendered state it caught.
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });

      const violations = await scanForViolations(page);
      expect(violations, describeViolations(violations)).toEqual([]);
    });
  }
});
