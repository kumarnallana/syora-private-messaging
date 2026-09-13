import { expect, test, type Page, type Route } from '@playwright/test';

const fixedNow = new Date('2026-09-13T08:00:00.000Z');
const me = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Session User',
  username: 'session_user',
  email: 'session@example.com',
  about: '',
  color: 'iris',
  online: true,
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockSession(page: Page, role: 'admin' | 'user') {
  let activityCount = 0;
  await page.route('http://127.0.0.1:8000/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/refresh') return json(route, {
      user: { ...me, role },
      accessToken: `${role}-memory-token`,
      idleExpiresAt: role === 'admin' ? null : new Date(fixedNow.getTime() + 5 * 60_000).toISOString(),
    });
    if (path === '/api/auth/activity') {
      activityCount += 1;
      return json(route, { idleExpiresAt: new Date(fixedNow.getTime() + 9 * 60_000).toISOString() });
    }
    if (path === '/api/conversations') return json(route, []);
    if (path === '/api/contacts' || path === '/api/friend-requests') return json(route, { users: [], friendships: [] });
    if (path === '/api/status') return json(route, { users: [], statuses: [] });
    if (path === '/api/preferences') return json(route, { lastSeen: 'Friends', photo: 'Friends', status: 'Friends', receipts: true, notifications: true, sound: true, appearance: 'dark', compact: false, blocked: [], blockedUsers: [] });
    return json(route, {});
  });
  return () => activityCount;
}

test('normal user expires after five minutes while active interaction extends the session', async ({ page }) => {
  await page.clock.install({ time: fixedNow });
  const activityCount = await mockSession(page, 'user');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.clock.fastForward(4 * 60_000);
  await page.locator('.settings-page').click({ position: { x: 20, y: 600 } });
  await expect.poll(activityCount).toBeGreaterThan(0);
  await page.clock.fastForward(2 * 60_000);
  await expect(page).toHaveURL(/\/settings/);
  await page.clock.fastForward(3 * 60_000 + 1);
  await expect(page).toHaveURL(/\/login\?reason=idle/);
  await expect(page.getByText('Your SYORA session ended after 5 minutes of inactivity.')).toBeVisible();
});

test('admin is exempt from idle logout and auth credentials stay out of browser storage', async ({ page }) => {
  await page.clock.install({ time: fixedNow });
  const activityCount = await mockSession(page, 'admin');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.clock.fastForward(10 * 60_000);
  await expect(page).toHaveURL(/\/settings/);
  expect(activityCount()).toBe(0);
  const storage = await page.evaluate(async () => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage)),
    databases: 'databases' in indexedDB ? (await indexedDB.databases()).map(database => database.name) : [],
  }));
  expect(JSON.stringify(storage)).not.toContain('admin-memory-token');
  expect(JSON.stringify(storage)).not.toContain('password');
  expect(storage.session).toEqual({});
  expect(storage.databases).toEqual([]);
});
