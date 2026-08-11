import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readStaffCredentials, signIn } from './authFixture.js';

/**
 * Accessibility scans for the CX and admin surfaces.
 *
 * These pages need a real session, so they were the last part of the product
 * with no automated coverage at all. Read-only: each test loads a page and
 * analyses the rendered DOM. Nothing is submitted, edited, or deleted.
 *
 * Skips when credentials are absent so CI stays green without secrets.
 */

const credentials = readStaffCredentials();

const SERIOUS = ['critical', 'serious'];

async function scan(page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations.filter((v) => SERIOUS.includes(v.impact));
}

function describe(violations) {
  return violations
    .map((v) => {
      const where = v.nodes
        .slice(0, 4)
        .map((n) => {
          const target = n.target.join(' ');
          const c = n.any?.[0]?.data;
          const detail = c?.contrastRatio
            ? ` (${c.fgColor} on ${c.bgColor} = ${c.contrastRatio})`
            : '';
          return `${target}${detail}`;
        })
        .join('\n         ');
      return `[${v.impact}] ${v.id}: ${v.help}\n      at: ${where}`;
    })
    .join('\n');
}

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

  test.beforeEach(async ({ page }) => {
    await signIn(page, credentials);
  });

  for (const route of STAFF_ROUTES) {
    test(`${route.name} has no serious axe violations`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator(route.ready).first()).toBeVisible({ timeout: 30_000 });
      // Let async panels settle so the scan sees loaded content, not skeletons.
      await page.waitForTimeout(1500);

      const violations = await scan(page);
      expect(violations, describe(violations)).toEqual([]);
    });
  }
});
