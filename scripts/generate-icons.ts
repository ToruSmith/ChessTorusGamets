// Rasterise public/icons/icon.svg into the PNG sizes the web app manifest and iOS need.
// Usage: node scripts/generate-icons.ts   (uses Playwright's Chromium)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const dir = join(import.meta.dirname, '..', 'public', 'icons');
const svg = readFileSync(join(dir, 'icon.svg'), 'utf8');
const sizes = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size } of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path: join(dir, file), omitBackground: false });
}
await browser.close();
console.log(sizes.map((s) => s.file).join(', '));
