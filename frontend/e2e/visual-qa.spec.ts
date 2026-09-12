import { expect, test, type Page, type Route } from '@playwright/test';

const ids = {
  me: '11111111-1111-4111-8111-111111111111',
  friend: '22222222-2222-4222-8222-222222222222',
  result: '33333333-3333-4333-8333-333333333333',
  conversation: '44444444-4444-4444-8444-444444444444',
  message: '55555555-5555-4555-8555-555555555555',
};

const avatar = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#563f78"/><circle cx="60" cy="43" r="23" fill="#f1c7a5"/><path d="M20 120c4-35 23-49 40-49s36 14 40 49" fill="#191724"/></svg>',
)}`;

const me = { id: ids.me, name: 'Kumar Nallana', username: '@@kumargaru', email: 'qa@example.com', about: 'Private by design.', avatar, color: 'iris', online: true };
const friend = { id: ids.friend, name: 'Nallana Sasi Kumar', username: '@sam', email: 'friend@example.com', about: 'A close friend.', avatar, color: 'plum', online: false, lastSeen: '2026-09-12T10:43:19.208Z' };
const result = { id: ids.result, name: 'Red Friend', username: '@@red2003', email: 'red@example.com', about: '', color: 'rose', online: false };
const conversation = { id: ids.conversation, participants: [ids.me, ids.friend], unread: 1, pinned: false, muted: false, typing: false };
const message = { id: ids.message, conversationId: ids.conversation, senderId: ids.friend, text: 'This stays between us.', createdAt: '2026-09-12T10:45:00.000Z', receipt: 'delivered' };
const status = { id: '66666666-6666-4666-8666-666666666666', userId: ids.friend, text: 'A quiet evening.', color: '#4c3f66', createdAt: '2026-09-12T10:45:00.000Z', expiresAt: '2099-09-13T10:45:00.000Z', viewedBy: [] };

async function fulfill(route: Route, body: unknown, statusCode = 200) {
  await route.fulfill({ status: statusCode, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockAuthenticated(page: Page) {
  await page.route('http://127.0.0.1:8000/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/refresh') return fulfill(route, { user: me, accessToken: 'visual-qa-token' });
    if (path === '/api/conversations') return fulfill(route, [{ ...conversation, participant: friend, latestMessage: message }]);
    if (path === `/api/conversations/${ids.conversation}/messages`) return fulfill(route, { messages: [message], nextCursor: null });
    if (path === '/api/contacts') return fulfill(route, { users: [friend], friendships: [{ id: '77777777-7777-4777-8777-777777777777', from: ids.me, to: ids.friend, status: 'accepted' }] });
    if (path === '/api/friend-requests') return fulfill(route, { users: [], friendships: [] });
    if (path === '/api/status') return fulfill(route, { users: [me, friend], statuses: [status] });
    if (path === '/api/preferences') return fulfill(route, { lastSeen: 'Friends', photo: 'Friends', status: 'Friends', receipts: true, notifications: true, sound: true, appearance: 'dark', compact: false, blocked: [], blockedUsers: [] });
    if (path === '/api/people/search') return fulfill(route, [result]);
    if (request.method() === 'PATCH' || request.method() === 'POST' || request.method() === 'DELETE') return fulfill(route, {});
    return fulfill(route, { error: { message: `Unhandled visual QA route: ${path}` } }, 404);
  });
}

async function mockUnauthenticated(page: Page) {
  await page.route('http://127.0.0.1:8000/**', route => fulfill(route, { error: { code: 'REFRESH_REQUIRED', message: 'Your session has expired.' } }, 401));
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }))).toEqual(expect.objectContaining({ scroll: expect.any(Number), viewport: expect.any(Number) }));
  const values = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(values.scroll).toBeLessThanOrEqual(values.viewport + 1);
}

test('390px auth states are usable and validation is semantic', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockUnauthenticated(page);
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Make yourself at home.' })).toBeVisible();
  await page.getByLabel('Display name').fill('QA User');
  await page.getByLabel('Username').fill('@@QA_User');
  await page.getByLabel('Email').fill('qa@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  const confirmPassword = page.locator('input[autocomplete="new-password"]').nth(1);
  await confirmPassword.fill('different123');
  await page.getByRole('button', { name: 'Create account' }).click();
  const mismatch = page.getByText('Passwords do not match.');
  await expect(mismatch).toBeVisible();
  await expect(confirmPassword).toHaveAttribute('aria-invalid', 'true');
  await expectNoHorizontalOverflow(page);

  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: 'Find your way back.' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('390px app screens, avatar shape, handles, details and composer remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuthenticated(page);

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('.mobile-account-row').getByText('@kumargaru')).toBeVisible();
  await expect(page.getByText('@@kumargaru')).toHaveCount(0);
  const avatarBox = await page.locator('.mobile-account-row .avatar').boundingBox();
  expect(avatarBox).not.toBeNull();
  expect(Math.abs(avatarBox!.width - avatarBox!.height)).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);

  await page.goto('/contacts');
  await expect(page.getByText('Search for people by name or @username.')).toBeVisible();
  await page.getByLabel('Search people').fill('@red2003');
  await expect(page.getByText('@red2003')).toBeVisible();
  await expect(page.getByText('@@red2003')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.goto(`/chats?conversation=${ids.conversation}`);
  await expect(page.getByRole('heading', { name: friend.name })).toBeVisible();
  await expect(page.getByText(/Last seen/)).toBeVisible();
  await expect(page.getByText(friend.lastSeen)).toHaveCount(0);
  const composer = page.locator('.composer');
  await expect(composer).toBeVisible();
  await page.getByLabel('Conversation options').click();
  const detailButtons = page.locator('.detail-actions button');
  await expect(detailButtons).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const box = await detailButtons.nth(index).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(40);
  }
  await page.getByLabel('Close dialog').click();

  await page.getByRole('textbox', { name: 'Message', exact: true }).focus();
  await page.setViewportSize({ width: 390, height: 520 });
  await page.waitForTimeout(100);
  const composerBox = await composer.boundingBox();
  expect(composerBox).not.toBeNull();
  expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(521);
  await expect(page.getByLabel('Send message')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/status');
  await expect(page.getByRole('heading', { name: 'Status', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Recent updates')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto('/profile');
  await expect(page.getByRole('button', { name: 'Save profile' })).toBeDisabled();
  const profileAvatar = await page.locator('.avatar-editor .avatar').boundingBox();
  expect(Math.abs(profileAvatar!.width - profileAvatar!.height)).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);
});

for (const viewport of [{ width: 768, height: 900 }, { width: 1440, height: 1000 }]) {
  test(`${viewport.width}px representative layout has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockAuthenticated(page);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto('/chats');
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
