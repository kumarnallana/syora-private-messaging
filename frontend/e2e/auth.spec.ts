import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  const timestamp = Date.now();
  const userA = `userA_${timestamp}@example.com`;

  test('User registration and login', async ({ page }) => {
    // Register
    await page.goto('/register');

    await expect(page.locator('.auth-form h2')).toBeVisible({ timeout: 10000 });
    
    await page.fill('input[autocomplete="name"]', 'User A');
    await page.fill('input[type="email"]', userA);
    await page.fill('input[autocomplete="current-password"]', 'password123');
    await page.fill('input[autocomplete="new-password"]', 'password123');
    await page.click('button.button.primary.full');
    await expect(page).toHaveURL(/\/chats/, { timeout: 15000 });

    // Logout
    await page.goto('/settings');
    await page.click('button.settings-menu-row.danger-text');
    await page.click('.modal button.button.danger');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Login again
    await page.fill('input[type="email"]', userA);
    await page.fill('input[autocomplete="current-password"]', 'password123');
    await page.click('button.button.primary.full');
    await expect(page).toHaveURL(/\/chats/, { timeout: 15000 });
  });
});

