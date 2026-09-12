import { test, expect, type Browser, type BrowserContext } from '@playwright/test';

const API = 'http://127.0.0.1:8000';

async function register(browser: Browser, name: string, email: string, password: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/register');
  await expect(page.locator('.auth-form h2')).toBeVisible({ timeout: 10000 });
  await page.fill('input[autocomplete="name"]', name);
  await page.fill('input[type="email"]', email);
  await page.fill('input[autocomplete="current-password"]', password);
  await page.fill('input[autocomplete="new-password"]', password);
  await page.click('button.button.primary.full');
  await expect(page).toHaveURL(/\/chats/, { timeout: 20000 });
  return { ctx, page };
}

test.describe('SYORA E2E Flows', () => {
  const ts = Date.now();
  const emailA = `a_${ts}@example.com`;
  const emailB = `b_${ts}@example.com`;
  const emailC = `c_${ts}@example.com`;
  const pass = 'password1234';

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

  test('Privacy: User C cannot access A-B API resources', async ({ browser }) => {
    test.setTimeout(60000);
    const ts = Date.now();
    // Register C separately (no friendship with anyone)
    const { ctx: ctxC } = await register(browser, 'Charlie', `c_${ts}@example.com`, 'password1234');

    // Try to list a fabricated conversation — should get 403
    const res = await ctxC.request.get(`${API}/api/conversations/00000000-0000-0000-0000-000000000001/messages`, {
      headers: { Origin: 'http://127.0.0.1:3001' }
    });
    expect(res.status()).toBe(403);

    // Try to access a fabricated attachment ID
    const res2 = await ctxC.request.get(`${API}/api/media/00000000-0000-0000-0000-000000000002/access`, {
      headers: { Origin: 'http://127.0.0.1:3001' }
    });
    expect(res2.status()).toBe(403);

    await ctxC.close();
  });
});
