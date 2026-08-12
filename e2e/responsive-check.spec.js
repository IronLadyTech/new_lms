import { test, expect } from '@playwright/test';
import { GUEST_SESSION_KEY } from '../src/utils/guestSession.js';

/**
 * Responsive guard (UI-01 / UI-02).
 *
 * Asserts the two things that actually break a layout: content must never
 * overflow sideways, and must never stretch beyond a readable width on a large
 * screen. Runs at the five sizes real people use.
 */

const DEVICES = [
  { name: 'phone 375', width: 375, height: 812 },
  { name: 'tablet 768', width: 768, height: 1024 },
  { name: 'laptop 1024', width: 1024, height: 768 },
  { name: 'macbook 1440', width: 1440, height: 900 },
  { name: 'desktop 1920', width: 1920, height: 1080 },
];

const ROUTES = ['/app/home', '/app/progress', '/app/profile', '/app/support', '/app/calendar'];

const MAX_CONTENT = 1280;

for (const device of DEVICES) {
  test.describe(`${device.name}`, () => {
    test.use({ viewport: { width: device.width, height: device.height } });

    test('no sideways scroll and content stays within the max width', async ({ page }) => {
      await page.addInitScript((k) => window.sessionStorage.setItem(k, '1'), GUEST_SESSION_KEY);

      for (const path of ROUTES) {
        await page.goto(path);
        await expect(page.locator('.bottom-nav')).toBeVisible();
        await page.waitForTimeout(400);

        const m = await page.evaluate(() => {
          const main = document.querySelector('main');
          return {
            scrollW: document.documentElement.scrollWidth,
            clientW: document.documentElement.clientWidth,
            mainW: Math.round(main.getBoundingClientRect().width),
          };
        });

        expect(m.scrollW, `${path} scrolls sideways at ${device.width}px`).toBeLessThanOrEqual(
          m.clientW + 1
        );
        expect(m.mainW, `${path} exceeds the content cap at ${device.width}px`).toBeLessThanOrEqual(
          MAX_CONTENT + 1
        );
      }
    });
  });
}
