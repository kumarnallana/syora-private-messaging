import { expect, test, type Page, type Route } from '@playwright/test';

const ids = {
  me: '11111111-1111-4111-8111-111111111111',
  friend: '22222222-2222-4222-8222-222222222222',
  conversation: '44444444-4444-4444-8444-444444444444',
};
const me = { id: ids.me, name: 'Kumar Nallana', username: 'kumargaru', email: 'qa@example.com', role: 'user', about: 'Private by design.', color: 'iris', online: true };
const friend = { id: ids.friend, name: 'Nallana Sasi Kumar With A Long Name', username: 'samkumar', email: '', about: 'Sleeping peacefully', avatar: 'http://127.0.0.1:9/expired-avatar.jpg', color: 'plum', online: false };
const conversation = { id: ids.conversation, participants: [ids.me, ids.friend], unread: 1, pinned: false, muted: false, typing: false };
const incoming = { id: '55555555-5555-4555-8555-555555555551', conversationId: ids.conversation, senderId: ids.friend, text: 'Received on the left', createdAt: '2026-09-13T03:30:00.000Z', receipt: 'delivered' };
const outgoing = { id: '55555555-5555-4555-8555-555555555552', conversationId: ids.conversation, senderId: ids.me, text: 'Sent on the right', createdAt: '2026-09-13T03:31:00.000Z', receipt: 'read' };
const preferences = { lastSeen: 'Friends', photo: 'Friends', status: 'Friends', receipts: true, notifications: true, sound: true, appearance: 'dark', compact: false, blocked: [], blockedUsers: [] };

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockApp(page: Page, initiallyAuthenticated = true) {
  let authenticated = initiallyAuthenticated;
  await page.route('http://127.0.0.1:8000/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/login') {
      authenticated = true;
      return json(route, { user: me, accessToken: 'access-token', idleExpiresAt: new Date(Date.now() + 300_000).toISOString() });
    }
    if (path === '/api/auth/refresh') return authenticated
      ? json(route, { user: me, accessToken: 'access-token', idleExpiresAt: new Date(Date.now() + 300_000).toISOString() })
      : json(route, { error: { code: 'REFRESH_REQUIRED', message: 'Sign in.' } }, 401);
    if (path === '/api/auth/logout') { authenticated = false; return json(route, {}); }
    if (path === '/api/auth/activity') return json(route, { idleExpiresAt: new Date(Date.now() + 300_000).toISOString() });
    if (path === '/api/conversations') return json(route, [{ ...conversation, participant: friend, latestMessage: outgoing }]);
    if (path === `/api/conversations/${ids.conversation}/messages`) return json(route, { messages: [incoming, outgoing], nextCursor: null });
    if (path === '/api/contacts') return json(route, { users: [me, friend], friendships: [{ id: '77777777-7777-4777-8777-777777777777', from: ids.me, to: ids.friend, status: 'accepted' }] });
    if (path === '/api/friend-requests') return json(route, { users: [], friendships: [] });
    if (path === '/api/status') return json(route, { users: [me, friend], statuses: [] });
    if (path === '/api/preferences') return json(route, preferences);
    if (route.request().method() === 'PATCH' || route.request().method() === 'POST' || route.request().method() === 'DELETE') return json(route, {});
    return json(route, { error: { message: `Unhandled route ${path}` } }, 404);
  });
}

async function noHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(size.document).toBeLessThanOrEqual(size.viewport + 1);
}

test('login replacement, reload restoration, and nested browser Back preserve the app stack', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApp(page, false);
  await page.goto('/register');
  await page.goto('/login');
  await page.getByLabel('Email').fill('qa@example.com');
  await page.locator('input[autocomplete="current-password"]').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/chats$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/chats$/);

  await page.goto('/settings');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Privacy' }).click();
  await expect(page).toHaveURL(/section=privacy/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);

  await page.goto('/chats');
  await page.getByRole('button', { name: /Open conversation with/ }).click();
  await expect(page).toHaveURL(/conversation=/);
  await page.goBack();
  await expect(page).toHaveURL(/\/chats$/);
  await expect(page.locator('.chat-layout')).not.toHaveClass(/has-conversation/);
});

test('message ownership controls sides and failed avatars render initials', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApp(page);
  await page.goto(`/chats?conversation=${ids.conversation}`);
  const received = page.getByLabel('Received message').locator('.message-bubble');
  const sent = page.getByLabel('Sent by you').locator('.message-bubble');
  await expect(received).toBeVisible();
  await expect(sent).toBeVisible();
  const timeline = page.locator('.timeline');
  const [receivedBox, sentBox, timelineBox] = await Promise.all([received.boundingBox(), sent.boundingBox(), timeline.boundingBox()]);
  expect(receivedBox!.x).toBeLessThan(sentBox!.x);
  expect(receivedBox!.x).toBeLessThanOrEqual(timelineBox!.x + 20);
  expect(sentBox!.x + sentBox!.width).toBeGreaterThanOrEqual(timelineBox!.x + timelineBox!.width - 65);
  await expect(page.locator('.chat-header .avatar__image')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.chat-header .avatar__fallback')).toHaveText('NS');
});

for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
  test(`${viewport.width}px mobile rhythm, contacts, profile action, and light theme are stable`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockApp(page);
    await page.goto('/chats');
    const heading = await page.getByRole('heading', { name: 'Messages' }).boundingBox();
    expect(heading!.y).toBeLessThan(80);
    await noHorizontalOverflow(page);

    await page.goto('/contacts');
    await expect(page.locator('.person-card')).toHaveCount(1);
    await expect(page.locator('.person-card', { hasText: me.name })).toHaveCount(0);
    const card = page.locator('.person-card').first();
    const identity = await card.locator('.person-identity').boundingBox();
    const actions = await card.locator('.row-actions').boundingBox();
    expect(actions!.y).toBeGreaterThanOrEqual(identity!.y + identity!.height - 1);
    await noHorizontalOverflow(page);

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Appearance' }).click();
    await page.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const colors = await page.evaluate(() => {
      const heading = document.querySelector('.mobile-header__title')!;
      const body = document.body;
      return { heading: getComputedStyle(heading).color, body: getComputedStyle(body).backgroundColor };
    });
    expect(colors.heading).not.toBe(colors.body);

    await page.goto('/profile');
    const email = await page.locator('.account-email').boundingBox();
    const action = await page.locator('.profile-actions').boundingBox();
    expect(action!.y).toBeGreaterThanOrEqual(email!.y + email!.height - 1);
    await expect(page.locator('.profile-actions')).toHaveCSS('position', 'static');
    await noHorizontalOverflow(page);
  });
}

test('profile Back asks before discarding unsaved edits', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApp(page);
  await page.goto('/settings');
  await page.locator('.mobile-account-row').click();
  await page.getByLabel('Display name').fill('Changed name');
  await page.getByRole('button', { name: 'Go back' }).click();
  await expect(page.getByRole('heading', { name: 'Discard unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Stay' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.evaluate(() => window.history.back());
  await expect(page.getByRole('heading', { name: 'Discard unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test('explicit logout clears authentication and keeps the chosen login theme readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApp(page);
  await page.goto('/settings?section=appearance');
  await page.getByRole('radio', { name: 'Light' }).click();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).last().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('heading', { name: 'Good to have you here.' })).toBeVisible();
});
