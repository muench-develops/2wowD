import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });

  test('canvas element is present', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#game-container canvas');
    await expect(canvas).toBeVisible();
  });

  test('game title "Isoheim" appears in the page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Isoheim/);
  });
});
