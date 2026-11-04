import { expect, test } from '@playwright/test';

test('shows the home page in Traditional Chinese by default', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('./');

  await expect(page).toHaveTitle(/西洋棋/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-TW');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('西洋棋');
  await expect(page.locator('[data-mode]')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('switches to English and remembers the choice', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('button', { name: '切換語言' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chess');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chess');

  await page.getByRole('button', { name: 'Switch language' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('西洋棋');
});

test('fits a phone screen without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('./');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
