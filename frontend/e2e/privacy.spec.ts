import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:8000';
const ORIGIN = 'http://127.0.0.1:3001';

test.describe('Privacy: User C isolation', () => {
  const ts = Date.now();
  const emailC = `c_${ts}@example.com`;
  const pass = 'password1234';

  test('User C cannot access a non-member conversation via API', async ({ browser }) => {
    test.setTimeout(45000);

    // Register User C
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/register');
    await expect(page.locator('.auth-form h2')).toBeVisible({ timeout: 10000 });
    await page.fill('input[autocomplete="name"]', 'User C');
    await page.fill('input[type="email"]', emailC);
    await page.fill('input[autocomplete="current-password"]', pass);
    await page.fill('input[autocomplete="new-password"]', pass);
    await page.click('button.button.primary.full');
    await expect(page).toHaveURL(/\/chats/, { timeout: 20000 });

    // User C tries to access a fabricated conversation ID via API
    const fakeConvId = '00000000-0000-0000-0000-000000000001';
    const res = await ctx.request.get(`${API}/api/conversations/${fakeConvId}/messages`, {
      headers: { Origin: ORIGIN }
    });
    expect(res.status()).toBe(403);

    // User C tries to access a fabricated attachment ID via API
    const fakeAttachmentId = '00000000-0000-0000-0000-000000000002';
    const res2 = await ctx.request.get(`${API}/api/media/${fakeAttachmentId}/access`, {
      headers: { Origin: ORIGIN }
    });
    expect(res2.status()).toBe(403);

    await ctx.close();
  });
});
