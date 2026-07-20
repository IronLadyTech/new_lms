import { test, expect } from '@playwright/test';

test.describe('Mobile smoke (375px)', () => {
  test('auth login page is scrollable with tappable controls', async ({ page }) => {
    await page.goto('/auth/login');

    const email = page.getByLabel(/email/i);
    await expect(email).toBeVisible();

    const box = await email.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

    const submit = page.getByRole('button', { name: /sign in|log in/i });
    await expect(submit).toBeVisible();
    const submitBox = await submit.boundingBox();
    expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('auth signup route renders without horizontal overflow', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth > root.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });

  test('unauthenticated app routes redirect to login', async ({ page }) => {
    await page.goto('/app/progress');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
