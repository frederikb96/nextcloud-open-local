/**
 * End-to-end run of the built extension in Chromium against a local fake Nextcloud and the real
 * opener, registered as a native messaging host in the test profile. The browser resolves the
 * Nextcloud host name to this machine only (every other host fails to resolve), and the opener
 * hands files to a stub script instead of a desktop application.
 *
 * Run with `bun run test:e2e`. Needs a Chromium that still honours --load-extension (Playwright's
 * bundled one); set CHROMIUM_PATH to override its location.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { type BrowserContext, chromium, type Worker } from 'playwright-core';
import pkg from '../../package.json' with { type: 'json' };
import { buildManifest } from '../../src/manifest.ts';
import { extensionIdFromKey } from '../helpers/extension-id.ts';
import { makeSandbox, OPENER, type Sandbox, touch } from '../helpers/opener.ts';

const root = resolve(import.meta.dir, '..', '..');
const executable = process.env.CHROMIUM_PATH ?? chromium.executablePath();
const HOST = 'cloud.example.org';
const TOKEN = 'test-request-token';

interface Seen {
  method: string;
  path: string;
  token: string | null;
}
const seen: Seen[] = [];

const multistatus = (entries: Array<[string, string]>) =>
  `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">${entries
    .map(
      ([path, id]) =>
        `<d:response><d:href>/remote.php/dav/files/bob${path
          .split('/')
          .map(encodeURIComponent)
          .join(
            '/',
          )}</d:href><d:propstat><d:prop><oc:fileid>${id}</oc:fileid></d:prop></d:propstat></d:response>`,
    )
    .join('')}</d:multistatus>`;

// What the fake server knows: id -> path.
const FILES: Record<string, string> = {
  '101': '/Docs/Quarterly Report.docx',
  '102': '/Docs/not-synced-yet.docx',
  '103': '/Moved/Elsewhere.odt',
};

const PAGE = `<!doctype html><html><head data-user="bob" data-requesttoken="${TOKEN}"><title>Files</title></head><body>files</body></html>`;

let tmp: string;
let sandbox: Sandbox;
let server: ReturnType<typeof Bun.serve>;
let context: BrowserContext;
let worker: Worker;

function selfSignedCert(dir: string) {
  const key = join(dir, 'key.pem');
  const cert = join(dir, 'cert.pem');
  const run = Bun.spawnSync([
    'openssl',
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    key,
    '-out',
    cert,
    '-days',
    '1',
    '-subj',
    '/CN=nextcloud-open-local-e2e',
    '-addext',
    `subjectAltName=DNS:${HOST}`,
  ]);
  if (run.exitCode !== 0) throw new Error(`openssl failed: ${run.stderr.toString()}`);
  return { key: readFileSync(key, 'utf8'), cert: readFileSync(cert, 'utf8') };
}

async function waitFor<T>(
  what: string,
  probe: () => Promise<T | undefined | false> | T | undefined | false,
  ms = 20_000,
): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await Bun.sleep(150);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

/** Opens a Files page for the file and fires the toolbar button's click event on its tab. */
async function clickOn(pageUrl: string) {
  const page = await context.newPage();
  await page.goto(pageUrl);
  await worker.evaluate(() => chrome.storage.session.clear());
  await worker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url });
    // The click event the toolbar button fires; dispatch is available to the worker under test.
    (chrome.action.onClicked as unknown as { dispatch(tab: unknown): void }).dispatch(tab);
  }, pageUrl);
  const result = await waitFor('the outcome', () =>
    worker.evaluate(async () => (await chrome.storage.session.get('lastResult')).lastResult),
  );
  await page.close();
  return result as { ok: boolean; path?: string; localPath?: string; message?: string };
}

const available = existsSync(executable);

beforeAll(async () => {
  if (!available) return;
  tmp = mkdtempSync(join(tmpdir(), 'nc-open-e2e-'));
  const build = Bun.spawnSync(['bun', 'run', 'scripts/build.ts'], { cwd: root });
  if (build.exitCode !== 0) throw new Error(`build failed: ${build.stderr.toString()}`);

  // The test copy may read the fake host without the click's one-off grant, which a dispatched
  // event does not carry.
  const extDir = join(tmp, 'extension');
  cpSync(join(root, 'dist'), extDir, { recursive: true });
  const manifestPath = join(extDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = [`https://${HOST}/*`];
  writeFileSync(manifestPath, JSON.stringify(manifest));

  sandbox = makeSandbox();
  touch(join(sandbox.home, 'Nextcloud/Docs/Quarterly Report.docx'));
  touch(join(sandbox.home, 'Nextcloud/Moved/Elsewhere.odt'));

  const tls = selfSignedCert(tmp);
  server = Bun.serve({
    port: 0,
    tls,
    async fetch(req) {
      const url = new URL(req.url);
      seen.push({ method: req.method, path: url.pathname, token: req.headers.get('requesttoken') });
      if (req.method === 'GET') {
        return new Response(PAGE, { headers: { 'Content-Type': 'text/html' } });
      }
      if (req.headers.get('requesttoken') !== TOKEN) return new Response('csrf', { status: 412 });
      if (req.method === 'PROPFIND') {
        const dir = decodeURIComponent(
          url.pathname.replace('/remote.php/dav/files/bob', ''),
        ).replace(/\/$/, '');
        const entries = Object.entries(FILES)
          .filter(([, path]) => path.startsWith(`${dir}/`))
          .map(([id, path]) => [path, id] as [string, string]);
        return entries.length
          ? new Response(multistatus(entries), { status: 207 })
          : new Response('', { status: 404 });
      }
      if (req.method === 'SEARCH') {
        const id = /<d:literal>(\d+)<\/d:literal>/.exec(await req.text())?.[1] ?? '';
        const path = FILES[id];
        return new Response(multistatus(path ? [[path, id]] : []), { status: 207 });
      }
      return new Response('unsupported', { status: 405 });
    },
  });

  const userData = join(tmp, 'profile');
  mkdirSync(join(userData, 'NativeMessagingHosts'), { recursive: true });
  const id = await extensionIdFromKey(buildManifest(pkg.version).key);
  writeFileSync(
    join(userData, 'NativeMessagingHosts', 'nextcloud_open_local.json'),
    JSON.stringify({
      name: 'nextcloud_open_local',
      description: 'test',
      path: OPENER,
      type: 'stdio',
      allowed_origins: [`chrome-extension://${id}/`],
    }),
  );
  context = await chromium.launchPersistentContext(userData, {
    executablePath: executable,
    headless: true,
    ignoreHTTPSErrors: true,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      ...sandbox.env,
    },
    args: [
      `--disable-extensions-except=${extDir}`,
      `--load-extension=${extDir}`,
      `--host-resolver-rules=MAP ${HOST} 127.0.0.1:${server.port}, MAP * ~NOTFOUND, EXCLUDE 127.0.0.1`,
      '--ignore-certificate-errors',
      '--no-sandbox',
    ],
  });
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
}, 60_000);

afterAll(async () => {
  await context?.close();
  server?.stop(true);
  for (const dir of [tmp, sandbox?.dir])
    if (dir?.includes('nc-open-')) rmSync(dir, { recursive: true, force: true });
});

const fileUrl = (id: string, dir: string) =>
  `https://${HOST}/apps/files/files/${id}?dir=${encodeURIComponent(dir)}&openfile=true`;

describe.skipIf(!available)('extension in Chromium', () => {
  test('loads under the id that the opener allows', async () => {
    expect(new URL(worker.url()).host).toBe(
      await extensionIdFromKey(buildManifest(pkg.version).key),
    );
  });

  test('click: resolves the path through WebDAV and the opener launches the synced copy', async () => {
    seen.length = 0;
    const result = await clickOn(fileUrl('101', '/Docs'));
    const expected = join(sandbox.home, 'Nextcloud/Docs/Quarterly Report.docx');
    expect(result).toEqual({ ok: true, path: '/Docs/Quarterly Report.docx', localPath: expected });
    await waitFor('the launcher call', () => existsSync(sandbox.opened));
    expect(readFileSync(sandbox.opened, 'utf8').trim().split('\n').pop()).toBe(expected);
    const dav = seen.filter((r) => r.method !== 'GET');
    expect(dav.map((r) => r.method)).toEqual(['PROPFIND']);
    expect(dav[0]?.token).toBe(TOKEN);
  });

  test('click: finds a file outside the folder named in the address by searching', async () => {
    seen.length = 0;
    const result = await clickOn(fileUrl('103', '/Docs'));
    expect(result).toMatchObject({ ok: true, path: '/Moved/Elsewhere.odt' });
    expect(seen.filter((r) => r.method !== 'GET').map((r) => r.method)).toEqual([
      'PROPFIND',
      'SEARCH',
    ]);
  });

  test('click: a file the desktop client has not synced is reported and nothing launches', async () => {
    const before = readFileSync(sandbox.opened, 'utf8');
    const result = await clickOn(fileUrl('102', '/Docs'));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not-synced-yet.docx');
    expect(readFileSync(sandbox.opened, 'utf8')).toBe(before);
  });

  test('click: a page without a selected file only reports', async () => {
    const result = await clickOn(`https://${HOST}/apps/files/files?dir=/Docs`);
    expect(result.ok).toBe(false);
  });
});
