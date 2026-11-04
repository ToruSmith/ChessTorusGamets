// Games against Stockfish.js (the real engine, in a Web Worker) and post-game review.
import { expect, test, type Page } from '@playwright/test';

async function clickMove(page: Page, from: string, to: string) {
  await page.locator(`rect[data-square="${from}"]`).click();
  await page.locator(`rect[data-square="${to}"]`).click();
}

const sans = (page: Page) => page.getByTestId('move-list').locator('[data-san]');

async function startComputerGame(page: Page, color: '白方' | '黑方' = '白方', level = '第 1 級') {
  await page.goto('./#/computer');
  await page.getByRole('radio', { name: color }).check();
  await page.getByRole('radio', { name: level }).check();
  await page.getByRole('button', { name: '開始對局' }).click();
  await expect(page.getByTestId('board')).toBeVisible();
}

test('the computer replies to your move', async ({ page }) => {
  await startComputerGame(page);
  await clickMove(page, 'e2', 'e4');
  await expect(page.getByTestId('thinking')).toBeHidden({ timeout: 15_000 });
  await expect(page.getByTestId('status')).toHaveText('輪到白方');
  await expect(sans(page).nth(1)).not.toHaveText('');
});

test('the computer moves first when you play Black', async ({ page }) => {
  await startComputerGame(page, '黑方');
  await expect(page.getByTestId('board')).toHaveAttribute('data-orientation', 'b');
  await expect(page.getByTestId('status')).toHaveText('輪到黑方', { timeout: 15_000 });
});

test('hint draws an arrow; undo takes back both moves', async ({ page }) => {
  await startComputerGame(page);
  await page.getByRole('button', { name: '提示' }).click();
  await expect(page.locator('[data-arrow]')).toHaveCount(1, { timeout: 15_000 });
  await clickMove(page, 'd2', 'd4');
  await expect(page.locator('[data-arrow]')).toHaveCount(0);
  await expect(page.getByTestId('status')).toHaveText('輪到白方', { timeout: 15_000 });
  await page.getByRole('button', { name: '悔棋' }).click();
  await expect(page.getByTestId('move-list')).toHaveCount(0);
});

test('resign, then review the game with the engine', async ({ page }) => {
  await startComputerGame(page);
  await clickMove(page, 'f2', 'f3');
  await expect(page.getByTestId('status')).toHaveText('輪到白方', { timeout: 15_000 });
  await page.getByRole('button', { name: '認輸' }).click();
  await page.getByRole('button', { name: '確定' }).click();
  await expect(page.getByTestId('result')).toContainText('黑方勝');
  await page.getByTestId('result').getByRole('button', { name: '賽後分析' }).click();

  await expect(page).toHaveURL(/#\/analysis$/);
  await expect(page.getByTestId('analysis-progress')).toHaveText('分析完成', { timeout: 30_000 });
  await expect(page.getByTestId('analysis-summary')).toContainText('白方');
  await expect(page.locator('[data-arrow]')).toHaveCount(1);
  await expect(page.getByTestId('analysis-best')).toContainText('電腦推薦');

  await page.keyboard.press('Home');
  await expect(page.locator('g[data-piece][data-square="f2"]')).toHaveAttribute('data-piece', 'wP');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('g[data-piece][data-square="f3"]')).toHaveAttribute('data-piece', 'wP');
});

test('a finished two-player game can be reviewed', async ({ page }) => {
  await page.goto('./#/local');
  await page.getByRole('button', { name: '開始對局' }).click();
  for (const [from, to] of [
    ['f2', 'f3'],
    ['e7', 'e5'],
    ['g2', 'g4'],
    ['d8', 'h4'],
  ] as const) {
    await clickMove(page, from, to);
  }
  await page.getByTestId('result').getByRole('button', { name: '賽後分析' }).click();
  await expect(page.getByTestId('analysis-progress')).toHaveText('分析完成', { timeout: 30_000 });
  await expect(page.locator('[data-judgement="blunder"]').first()).toBeVisible();
});

test('the review page explains when there is nothing to review', async ({ page }) => {
  await page.goto('./#/analysis');
  await expect(page.getByTestId('analysis-empty')).toBeVisible();
});
