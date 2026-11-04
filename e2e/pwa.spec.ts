// Installable and offline: the service worker precaches the whole build, engine included.
import { expect, test } from '@playwright/test';

test('links the web app manifest', async ({ page }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(href ?? '')).json();
  expect(manifest.short_name).toBe('西洋棋');
  expect(manifest.icons.length).toBeGreaterThan(1);
});

test('works offline, including the computer opponent', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('西洋棋');

  await page.goto('./#/computer');
  await page.getByRole('radio', { name: '第 4 級' }).check();
  await page.getByRole('button', { name: '開始對局' }).click();
  // Leave the opening book at once so the (cached) engine has to answer.
  await page.locator('rect[data-square="a2"]').click();
  await page.locator('rect[data-square="a3"]').click();
  await expect(page.getByTestId('status')).toHaveText('輪到白方', { timeout: 20_000 });
  await page.getByRole('button', { name: '提示' }).click();
  await expect(page.locator('[data-arrow]')).toHaveCount(1, { timeout: 20_000 });
  await context.setOffline(false);
});
