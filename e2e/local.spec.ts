import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'chess.local.v1';

async function startGame(page: Page, timeControl = '不計時') {
  await page.goto('./#/local');
  await page.getByRole('radio', { name: timeControl, exact: true }).check();
  await page.getByRole('button', { name: '開始對局' }).click();
  await expect(page.getByTestId('board')).toBeVisible();
}

async function clickMove(page: Page, from: string, to: string) {
  await page.locator(`rect[data-square="${from}"]`).click();
  await page.locator(`rect[data-square="${to}"]`).click();
}

async function dragMove(page: Page, from: string, to: string) {
  const source = await page.locator(`rect[data-square="${from}"]`).boundingBox();
  const target = await page.locator(`rect[data-square="${to}"]`).boundingBox();
  if (!source || !target) throw new Error('square not found');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
  await page.mouse.up();
}

const piece = (page: Page, square: string) =>
  page.locator(`g[data-piece][data-square="${square}"]`);

/** Start from a saved record so a test can begin in any position. */
async function loadPosition(page: Page, startFen: string) {
  await page.goto('./');
  await page.evaluate(
    ({ key, fen }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, startFen: fen, timeControl: null, moves: [], events: [] }),
      ),
    { key: STORAGE_KEY, fen: startFen },
  );
  await page.goto('./#/local');
}

test('opens two-player mode from the home page', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: /雙人同機/ }).click();
  await expect(page).toHaveURL(/#\/local$/);
  await expect(page.getByRole('heading', { name: /新對局/ })).toBeVisible();
});

test('moves by clicking and by dragging, and refuses illegal moves', async ({ page }) => {
  await startGame(page);
  await expect(page.getByTestId('status')).toHaveText('輪到白方');

  await clickMove(page, 'e2', 'e5'); // illegal
  await expect(piece(page, 'e2')).toHaveAttribute('data-piece', 'wP');

  await clickMove(page, 'e2', 'e4');
  await expect(piece(page, 'e4')).toHaveAttribute('data-piece', 'wP');
  await dragMove(page, 'e7', 'e5');
  await expect(piece(page, 'e5')).toHaveAttribute('data-piece', 'bP');

  await expect(page.getByTestId('move-list')).toContainText('e4');
  await expect(page.getByTestId('move-list')).toContainText('e5');
  await expect(page.getByTestId('status')).toHaveText('輪到白方');
});

test('shows legal targets for the selected piece', async ({ page }) => {
  await startGame(page);
  await page.locator('rect[data-square="g1"]').click();
  await expect(page.locator('[data-target]')).toHaveCount(2);
  await page.locator('rect[data-square="g1"]').click();
  await expect(page.locator('[data-target]')).toHaveCount(0);
});

test('checkmate shows the result; undo takes it back', async ({ page }) => {
  await startGame(page);
  for (const [from, to] of [
    ['f2', 'f3'],
    ['e7', 'e5'],
    ['g2', 'g4'],
    ['d8', 'h4'],
  ] as const) {
    await clickMove(page, from, to);
  }
  const result = page.getByTestId('result');
  await expect(result).toContainText('黑方勝');
  await expect(result).toContainText('將死');
  await result.getByRole('button', { name: '關閉' }).click();
  await expect(result).toBeHidden();

  await page.getByRole('button', { name: '悔棋' }).click();
  await expect(page.getByTestId('status')).toHaveText('輪到黑方');
  await expect(piece(page, 'd8')).toHaveAttribute('data-piece', 'bQ');
});

test('promotes through the piece picker', async ({ page }) => {
  await loadPosition(page, '8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
  await clickMove(page, 'e7', 'e8');
  const picker = page.getByTestId('promotion');
  await expect(picker).toBeVisible();
  await picker.locator('[data-promotion="n"]').click();
  await expect(piece(page, 'e8')).toHaveAttribute('data-piece', 'wN');
  await expect(page.getByTestId('move-list')).toContainText('e8=N');
});

test('the player to move can claim a threefold repetition', async ({ page }) => {
  await startGame(page);
  for (let round = 0; round < 2; round += 1) {
    await clickMove(page, 'g1', 'f3');
    await clickMove(page, 'g8', 'f6');
    await clickMove(page, 'f3', 'g1');
    await clickMove(page, 'f6', 'g8');
  }
  const claim = page.getByTestId('draw-claim');
  await expect(claim).toContainText('三次');
  await claim.getByRole('button', { name: '聲明和棋' }).click();
  await expect(page.getByTestId('result')).toContainText('和棋');
  await expect(page.getByTestId('result')).toContainText('三次');
});

test('a draw offer can be accepted', async ({ page }) => {
  await startGame(page);
  await clickMove(page, 'e2', 'e4');
  await page.getByRole('button', { name: '提和' }).click();
  await expect(page.getByTestId('draw-offer')).toContainText('黑方提出和棋');
  await page.getByRole('button', { name: '白方接受和棋' }).click();
  await expect(page.getByTestId('result')).toContainText('雙方同意和棋');
});

test('resigning asks for confirmation', async ({ page }) => {
  await startGame(page);
  await page.getByRole('button', { name: '認輸' }).click();
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.getByTestId('result')).toBeHidden();
  await page.getByRole('button', { name: '認輸' }).click();
  await page.getByRole('button', { name: '確定' }).click();
  await expect(page.getByTestId('result')).toContainText('黑方勝');
});

test('flips the board', async ({ page }) => {
  await startGame(page);
  await expect(page.getByTestId('board')).toHaveAttribute('data-orientation', 'w');
  await page.getByRole('button', { name: '翻轉棋盤' }).click();
  await expect(page.getByTestId('board')).toHaveAttribute('data-orientation', 'b');
  await clickMove(page, 'e2', 'e4');
  await expect(piece(page, 'e4')).toHaveAttribute('data-piece', 'wP');
});

test('keeps the game after a reload', async ({ page }) => {
  await startGame(page);
  await clickMove(page, 'd2', 'd4');
  await page.reload();
  await expect(piece(page, 'd4')).toHaveAttribute('data-piece', 'wP');
  await expect(page.getByTestId('status')).toHaveText('輪到黑方');
});

test('a timed game shows running clocks and has no undo', async ({ page }) => {
  await startGame(page, '3 分鐘 + 每步 2 秒');
  await expect(page.locator('[data-clock="w"]')).toHaveText('3:00');
  await clickMove(page, 'e2', 'e4');
  await expect(page.locator('[data-clock="w"]')).toHaveText('3:02');
  await expect(page.getByRole('button', { name: '悔棋' })).toBeDisabled();
});

test('the play screen fits a phone without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await startGame(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
