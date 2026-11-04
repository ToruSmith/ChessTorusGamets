// The English interface covers every screen (no Chinese text left in the page).
import { expect, test } from '@playwright/test';

const CJK = /[一-鿿]/;

test('every screen is translated to English', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '切換語言' }).click();
  await expect(page).toHaveTitle('Chess · ChessTorusGamets');

  for (const route of ['#/', '#/local', '#/computer', '#/online', '#/analysis', '#/puzzles']) {
    await page.goto(`./${route}`);
    await page
      .locator('main')
      .getByRole('heading')
      .or(page.getByTestId('analysis-empty'))
      .first()
      .waitFor();
    const text = await page.locator('main').innerText();
    expect(text, route).not.toMatch(CJK);
  }

  await page.goto('./#/local');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByTestId('status')).toHaveText('White to move');
  // The header's language button names the other language in that language (繁體中文).
  expect(await page.locator('main').innerText()).not.toMatch(CJK);
});
