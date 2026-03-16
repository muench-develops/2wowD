import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('login screen loads with form elements', async ({ page }) => {
    await page.goto('/');

    // Wait for Phaser to boot and the LoginScene to create DOM elements
    const usernameInput = page.locator('#login-username');
    const passwordInput = page.locator('#login-password');
    const loginButton = page.locator('#login-btn');
    const registerButton = page.locator('#register-btn');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
    await expect(registerButton).toBeVisible();
  });

  test('login form accepts user input', async ({ page }) => {
    await page.goto('/');

    const usernameInput = page.locator('#login-username');
    const passwordInput = page.locator('#login-password');

    await expect(usernameInput).toBeVisible();

    await usernameInput.fill('TestPlayer');
    await passwordInput.fill('TestPassword1');

    await expect(usernameInput).toHaveValue('TestPlayer');
    await expect(passwordInput).toHaveValue('TestPassword1');
  });

  test('login with empty fields shows error', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.locator('#login-btn');
    await expect(loginButton).toBeVisible();

    await loginButton.click();

    const errorMessage = page.locator('#login-error');
    await expect(errorMessage).not.toBeEmpty();
  });
});
