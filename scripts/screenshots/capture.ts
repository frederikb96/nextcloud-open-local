#!/usr/bin/env bun
/**
 * Renders the pictures in docs/images/ from invented content, in Playwright's bundled Chromium.
 * Run `bun run screenshots` after changing what a picture shows. CHROMIUM_PATH overrides the
 * browser location.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { filesPage, hero, notification } from './pages.ts';

const root = resolve(import.meta.dir, '..', '..');
const images = join(root, 'docs', 'images');
const icon = `data:image/png;base64,${readFileSync(join(root, 'icons', 'icon-128.png')).toString('base64')}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath(),
  args: ['--no-sandbox'],
});

async function render(html: string, width: number, height: number) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html);
  const png = await page.screenshot();
  await page.close();
  return png;
}

function save(name: string, png: Buffer) {
  const path = join(images, name);
  writeFileSync(path, png);
  console.log(`Wrote ${path}`);
}

const pageImage = `data:image/png;base64,${(await render(filesPage(1010, 616), 1010, 616)).toString('base64')}`;
save('hero.png', await render(hero(pageImage, icon), 1440, 860));
save(
  'no-local-copy.png',
  await render(
    notification(
      'The synced copy /home/maria/Nextcloud/Documents/Reports/Roadmap Draft.odt does not exist. The desktop client has not synced it (yet), or the folder is excluded.',
      icon,
    ),
    760,
    190,
  ),
);
await browser.close();
