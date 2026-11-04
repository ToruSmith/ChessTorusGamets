// Post-deploy check. Usage:
//   node scripts/smoke.ts <url> [--online] [--no-headers]
// --online       also connects to Firebase (anonymous sign-in, reads the lobby; writes nothing)
// --no-headers   skip the Cloudflare _headers checks (for a local `vite preview`)
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const base = args.find((arg) => !arg.startsWith('--'));
if (!base) {
  console.error('usage: node scripts/smoke.ts <url> [--online] [--no-headers]');
  process.exit(2);
}
const root = base.endsWith('/') ? base : `${base}/`;
const online = args.includes('--online');
const headers = !args.includes('--no-headers');

let failures = 0;
async function check(name: string, run: () => Promise<string | void>) {
  try {
    const note = await run();
    console.log(`✓ ${name}${note ? ` (${note})` : ''}`);
  } catch (error) {
    failures += 1;
    console.log(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const get = (path: string) => fetch(new URL(path, root));

let assetPath = '';
await check('home page', async () => {
  const response = await get('./');
  expect(response.ok, `HTTP ${response.status}`);
  const html = await response.text();
  expect(html.includes('id="root"'), 'not the app page');
  assetPath = /src="\.\/(assets\/[^"]+\.js)"/.exec(html)?.[1] ?? '';
  expect(assetPath, 'no script asset found');
});

if (headers) {
  await check('_headers: sw.js is not cached', async () => {
    const value = (await get('sw.js')).headers.get('cache-control') ?? '';
    expect(value.includes('no-cache'), `cache-control: ${value || '(none)'}`);
  });
  await check('_headers: assets are immutable', async () => {
    const value = (await get(assetPath)).headers.get('cache-control') ?? '';
    expect(value.includes('immutable'), `cache-control: ${value || '(none)'}`);
  });
}

await check('manifest and icons', async () => {
  const manifest = (await (await get('manifest.webmanifest')).json()) as {
    icons: { src: string }[];
  };
  for (const icon of manifest.icons) {
    const response = await get(icon.src);
    expect(response.ok, `${icon.src}: HTTP ${response.status}`);
  }
  return `${manifest.icons.length} icons`;
});

await check('engine files', async () => {
  const wasm = await get('engine/stockfish-19-lite-single.wasm');
  expect(wasm.ok, `HTTP ${wasm.status}`);
  const type = wasm.headers.get('content-type') ?? '';
  expect(type.includes('application/wasm'), `content-type: ${type}`);
  expect((await get('engine/SOURCE.txt')).ok, 'SOURCE.txt missing');
});

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));

await check('app starts without errors', async () => {
  await page.goto(root);
  await page.getByRole('heading', { level: 1 }).waitFor();
  expect(errors.length === 0, errors.join('; '));
});

await check('service worker and offline reload', async () => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 10_000 });
  await page.goto(`${root}#/local`);
  await page.getByRole('button').first().waitFor({ timeout: 10_000 });
  await context.setOffline(false);
});

await check('Firebase is configured', async () => {
  await page.goto(`${root}#/online`);
  await page.waitForTimeout(500);
  const unconfigured = await page.getByTestId('online-unconfigured').count();
  expect(unconfigured === 0, 'VITE_FIREBASE_* were not set at build time');
});

if (online) {
  await check('Firebase sign-in and lobby', async () => {
    await page.goto(`${root}#/online`);
    // The lobby list is empty (and hidden) when no rooms wait; either state means it loaded.
    await page
      .locator('[data-room]')
      .or(page.getByText(/目前沒有等待中的公開房間|No public rooms are waiting/))
      .first()
      .waitFor({ timeout: 20_000 });
    const failed = await page.getByText(/無法連上伺服器|Could not reach the server/).count();
    expect(
      failed === 0,
      'connection failed (check the API key restrictions and Authentication → Anonymous)',
    );
  });
}

await browser.close();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
