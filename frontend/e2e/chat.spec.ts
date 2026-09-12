import { test, expect, type Browser, type BrowserContext } from '@playwright/test';

async function register(browser: Browser, name: string, email: string, password: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/register');

  await expect(page.locator('.auth-form h2')).toBeVisible({ timeout: 10000 });
  await page.fill('input[autocomplete="name"]', name);
  await page.fill('input[autocomplete="username"]', email.split('@')[0].replace(/[^a-z0-9_]/g, '').toLowerCase());
  await page.fill('input[type="email"]', email);
  await page.locator('input[autocomplete="new-password"]').nth(0).fill(password);
  await page.locator('input[autocomplete="new-password"]').nth(1).fill(password);
  await page.click('button.button.primary.full');
  await expect(page).toHaveURL(/\/chats/, { timeout: 20000 });
  return { ctx, page };
}

test.describe('SYORA E2E Flows', () => {
  const ts = Date.now();
  test('Auth: Registration navigates to /chats', async ({ browser }) => {
    const ts = Date.now();
    const { page } = await register(browser, 'Alpha', `a_${ts}@example.com`, 'password1234');
    await expect(page.locator('.rail')).toBeVisible();
    await page.close();
  });

  test('Auth: Login after logout works', async ({ browser }) => {
    const ts = Date.now();
    const emailB = `b_${ts}@example.com`;
    const { page } = await register(browser, 'Beta', emailB, 'password1234');
    // Logout
    await page.goto('/settings');
    await page.click('button.settings-menu-row.danger-text');
    await page.click('.modal button.button.danger');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    // Login
    await page.fill('input[type="email"]', emailB);
    await page.fill('input[autocomplete="current-password"]', 'password1234');
    await page.click('button.button.primary.full');
    await expect(page).toHaveURL(/\/chats/, { timeout: 15000 });
    await page.close();
  });
});
