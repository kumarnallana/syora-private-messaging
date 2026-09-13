import { expect, test } from '@playwright/test';

test('registration renders while session restoration is still pending', async ({ page }) => {
  let releaseRefresh!: () => void;
  const refreshReleased = new Promise<void>(resolve => { releaseRefresh = resolve; });
  await page.route('http://127.0.0.1:8000/api/auth/refresh', async route => {
    await refreshReleased;
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'REFRESH_REQUIRED', message: 'Sign in.' } }),
    });
  });

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Make yourself at home.' })).toBeVisible();
  await expect(page.getByLabel('Display name')).toBeEditable();
  releaseRefresh();
});

test('public registration does not start the realtime client', async ({ page }) => {
  const realtimeRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/socket.io')) realtimeRequests.push(request.url());
  });
  await page.route('http://127.0.0.1:8000/api/auth/refresh', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'REFRESH_REQUIRED', message: 'Sign in.' } }),
  }));

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Make yourself at home.' })).toBeVisible();
  await page.waitForTimeout(250);
  expect(realtimeRequests).toEqual([]);
});
