// Online play between two tabs. The e2e build swaps Firebase for a same-browser backend
// (localStorage + storage events); the database rules are covered by unit tests.
import { expect, test, type Page } from '@playwright/test';

async function clickMove(page: Page, from: string, to: string) {
  await page.locator(`rect[data-square="${from}"]`).click();
  await page.locator(`rect[data-square="${to}"]`).click();
}

const piece = (page: Page, square: string) =>
  page.locator(`g[data-piece][data-square="${square}"]`);

/** Alice creates a room as White; returns the room code. */
async function createRoom(page: Page, options: { public?: boolean } = {}) {
  await page.goto('./#/online');
  await page.getByRole('radio', { name: '不計時' }).check();
  await page.getByRole('radio', { name: '白方' }).check();
  if (options.public === false) await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: '建立', exact: true }).click();
  await expect(page.getByTestId('room-waiting')).toBeVisible();
  const url = new URL(page.url());
  return url.hash.replace('#/r/', '');
}

async function twoPlayers(page: Page) {
  const code = await createRoom(page);
  const bob = await page.context().newPage();
  await bob.goto(`./#/r/${code}`);
  await bob.getByRole('button', { name: '加入對局' }).click();
  await expect(page.getByTestId('status')).toHaveText('輪到白方');
  await expect(bob.getByTestId('status')).toHaveText('輪到白方');
  return { code, alice: page, bob };
}

test('opens the online lobby from the home page', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: /線上對戰/ }).click();
  await expect(page).toHaveURL(/#\/online$/);
  await expect(page.getByRole('heading', { name: '建立房間' })).toBeVisible();
});

test('a public room shows up in the lobby and can be joined from there', async ({ page }) => {
  const code = await createRoom(page);
  await expect(page.getByTestId('room-link')).toContainText(`#/r/${code}`);

  const bob = await page.context().newPage();
  await bob.goto('./#/online');
  const row = bob.locator(`[data-room="${code}"]`);
  await expect(row).toContainText('你執黑方');
  await row.getByRole('button', { name: '加入' }).click();
  await expect(bob.getByTestId('board')).toHaveAttribute('data-orientation', 'b');
  await expect(page.getByTestId('board')).toHaveAttribute('data-orientation', 'w');
});

test('a private room is not listed but the code works', async ({ page }) => {
  const code = await createRoom(page, { public: false });
  const bob = await page.context().newPage();
  await bob.goto('./#/online');
  await expect(bob.getByText('目前沒有等待中的公開房間。')).toBeVisible();
  await bob.getByRole('textbox', { name: '房號', exact: true }).fill(code.toLowerCase());
  await bob.getByRole('button', { name: '前往' }).click();
  await expect(bob.getByRole('button', { name: '加入對局' })).toBeVisible();
});

test('rejects malformed codes and reports missing rooms', async ({ page }) => {
  await page.goto('./#/online');
  await page.getByRole('textbox', { name: '房號', exact: true }).fill('abc');
  await page.getByRole('button', { name: '前往' }).click();
  await expect(page.getByText('房號是 6 個英文字母或數字。')).toBeVisible();
  await page.goto('./#/r/ZZZZZZ');
  await expect(page.getByTestId('room-missing')).toBeVisible();
});

test('players move in turn and both see the checkmate; rematch swaps colours', async ({ page }) => {
  const { alice, bob, code } = await twoPlayers(page);

  await clickMove(bob, 'e7', 'e5'); // not Black's turn
  await expect(piece(bob, 'e7')).toHaveAttribute('data-piece', 'bP');

  await clickMove(alice, 'f2', 'f3');
  await expect(piece(bob, 'f3')).toHaveAttribute('data-piece', 'wP');
  await clickMove(bob, 'e7', 'e5');
  await clickMove(alice, 'g2', 'g4');
  await clickMove(bob, 'd8', 'h4');

  for (const p of [alice, bob]) {
    await expect(p.getByTestId('result')).toContainText('黑方勝');
    await expect(p.getByTestId('result')).toContainText('將死');
  }

  await alice.getByTestId('result').getByRole('button', { name: '再來一局' }).click();
  await expect(bob.getByTestId('rematch-status')).toContainText('對手想再來一局');
  await bob.getByTestId('result').getByRole('button', { name: '再來一局' }).click();

  await expect(alice).not.toHaveURL(new RegExp(`#/r/${code}$`));
  await expect(alice.getByTestId('board')).toHaveAttribute('data-orientation', 'b');
  await expect(bob.getByTestId('board')).toHaveAttribute('data-orientation', 'w');
  await expect(bob.getByTestId('status')).toHaveText('輪到白方');
  expect(new URL(bob.url()).hash).toBe(new URL(alice.url()).hash);
});

test('draw offer, acceptance and resignation', async ({ page }) => {
  const { alice, bob } = await twoPlayers(page);
  await clickMove(alice, 'e2', 'e4');
  await alice.getByRole('button', { name: '提和' }).click();
  await expect(alice.getByTestId('draw-offer-sent')).toBeVisible();
  await bob.getByTestId('draw-offer').getByRole('button', { name: '接受和棋' }).click();
  await expect(alice.getByTestId('result')).toContainText('雙方同意和棋');
});

test('resigning ends the game for both players', async ({ page }) => {
  const { alice, bob } = await twoPlayers(page);
  await bob.getByRole('button', { name: '認輸' }).click();
  await bob.getByRole('button', { name: '確定' }).click();
  await expect(alice.getByTestId('result')).toContainText('白方勝');
  await expect(alice.getByTestId('result')).toContainText('認輸');
  // Engine analysis opens only now that the game is over.
  await expect(alice.getByTestId('result').getByRole('button', { name: '賽後分析' })).toBeVisible();
});

test('no engine analysis while an online game is on', async ({ page }) => {
  const { alice } = await twoPlayers(page);
  await clickMove(alice, 'e2', 'e4');
  await expect(alice.getByText('對局進行中不提供引擎分析與提示。')).toBeVisible();
  await expect(alice.getByRole('button', { name: '賽後分析' })).toHaveCount(0);
  await expect(alice.getByRole('button', { name: '提示' })).toHaveCount(0);
});

test('a third visitor watches without being able to move', async ({ page }) => {
  const { alice, code } = await twoPlayers(page);
  const eve = await page.context().newPage();
  await eve.goto(`./#/r/${code}`);
  await expect(eve.getByTestId('spectating')).toBeVisible();
  await clickMove(eve, 'e2', 'e4');
  await expect(piece(eve, 'e2')).toHaveAttribute('data-piece', 'wP');
  await clickMove(alice, 'd2', 'd4');
  await expect(piece(eve, 'd4')).toHaveAttribute('data-piece', 'wP');
  await expect(eve.getByRole('button', { name: '認輸' })).toHaveCount(0);
});
