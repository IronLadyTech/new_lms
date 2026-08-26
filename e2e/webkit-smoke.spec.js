import { test, expect } from '@playwright/test';

/**
 * Safari-engine smoke (Playwright WebKit). Closes the report gap that only
 * Chromium + emulated viewports were covered. Not a substitute for a physical
 * iPhone, but catches WebKit layout/auth regressions on public pages.
 */
test.describe('WebKit — public auth', () => {
  test('login page renders and focuses the email field', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const email = page.getByLabel(/^email$/i);
    await expect(email).toBeVisible();
    await email.click();
    await expect(email).toBeFocused();
  });

  test('signup page renders primary CTA', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up|create|get started|register/i })).toBeVisible();
  });
});

test.describe('WebKit — mobile viewport', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('login fits a phone-sized WebKit viewport', async ({ page }) => {
    await page.goto('/auth/login');
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    const box = await heading.boundingBox();
    expect(box, 'heading should be on-screen').toBeTruthy();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
  });
});
