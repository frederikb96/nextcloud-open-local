import { afterAll, describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import { buildManifest } from '../src/manifest.ts';
import { extensionIdFromKey } from './helpers/extension-id.ts';
import { ask, askAll, makeSandbox, OPENER, type Sandbox, touch } from './helpers/opener.ts';

const sandboxes: Sandbox[] = [];
function sandbox(configText?: string) {
  const s = makeSandbox(configText);
  sandboxes.push(s);
  return s;
}
afterAll(() => {
  for (const s of sandboxes)
    if (s.dir.includes('nc-open-test-')) rmSync(s.dir, { recursive: true });
});

const ORIGIN = 'https://cloud.example.org';
const request = (path: string, extra: object = {}) => ({
  origin: ORIGIN,
  user: 'bob',
  path,
  ...extra,
});

describe('opener mapping', () => {
  test('maps a path under the root sync folder and opens it', async () => {
    const s = sandbox();
    touch(join(s.home, 'Nextcloud/Attachments/2026-01-01 Report.docx'));
    const reply = await ask(request('/Attachments/2026-01-01 Report.docx'), s.env);
    const expected = join(s.home, 'Nextcloud/Attachments/2026-01-01 Report.docx');
    expect(reply).toEqual({ ok: true, localPath: expected });
    expect(readFileSync(s.opened, 'utf8').trim()).toBe(expected);
  });

  test('prefers the folder with the longest matching remote path', async () => {
    const s = sandbox();
    touch(join(s.home, 'Projects/plan.xlsx'));
    touch(join(s.home, 'Nextcloud/Work/Projects/plan.xlsx'));
    const reply = await ask(request('/Work/Projects/plan.xlsx'), s.env);
    expect(reply).toEqual({ ok: true, localPath: join(s.home, 'Projects/plan.xlsx') });
  });

  test('does not treat a sibling with the same prefix as inside the folder', async () => {
    const s = sandbox();
    touch(join(s.home, 'Nextcloud/Work/Projects2/a.txt'));
    const reply = await ask(request('/Work/Projects2/a.txt'), s.env);
    expect(reply).toEqual({ ok: true, localPath: join(s.home, 'Nextcloud/Work/Projects2/a.txt') });
  });

  test('picks the account by server and user, also for a server in a sub-folder', async () => {
    const s = sandbox();
    touch(join(s.home, 'Other/n.txt'));
    const reply = await ask(
      { origin: 'https://other.example.net', user: 'alice', path: '/n.txt' },
      s.env,
    );
    expect(reply).toEqual({ ok: true, localPath: join(s.home, 'Other/n.txt') });
  });

  test('says so when the server has no account', async () => {
    const s = sandbox();
    const reply = await ask({ origin: 'https://nope.example.com', user: 'bob', path: '/a' }, s.env);
    expect(reply).toMatchObject({ ok: false, code: 'no-account' });
  });

  test('says so when the user is not the account user', async () => {
    const s = sandbox();
    const reply = await ask(request('/a', { user: 'mallory' }), s.env);
    expect(reply).toMatchObject({ ok: false, code: 'no-account' });
  });

  test('says so when no synced folder covers the path', async () => {
    const s = sandbox(
      '[Accounts]\n0\\Folders\\1\\localPath=/home/user/Docs/\n0\\Folders\\1\\targetPath=/Docs\n0\\dav_user=bob\n0\\url=https://cloud.example.org\n',
    );
    const reply = await ask(request('/Music/song.mp3'), s.env);
    expect(reply).toMatchObject({ ok: false, code: 'not-synced' });
  });
});

describe('opener refusals', () => {
  test('a file the client has not synced is reported, not silently ignored', async () => {
    const s = sandbox();
    const reply = await ask(request('/Attachments/missing.docx'), s.env);
    expect(reply).toMatchObject({ ok: false, code: 'no-local-copy' });
    expect(existsSync(s.opened)).toBe(false);
  });

  test('an online-only placeholder is named as such', async () => {
    const s = sandbox();
    touch(join(s.home, 'Nextcloud/big.iso.nextcloud'));
    const reply = await ask(request('/big.iso'), s.env);
    expect(reply).toMatchObject({ ok: false, code: 'online-only' });
  });

  test('parent-directory segments never leave the synced folder', async () => {
    const s = sandbox();
    const reply = await ask(request('/../../etc/passwd'), s.env);
    expect(reply).toMatchObject({ ok: false, code: 'bad-request' });
  });

  test('a launcher file type is not opened', async () => {
    const s = sandbox();
    touch(join(s.home, 'Nextcloud/evil.desktop'));
    const reply = await ask(request('/evil.desktop'), s.env);
    expect(reply).toMatchObject({ ok: false, code: 'refused' });
    expect(existsSync(s.opened)).toBe(false);
  });

  test('a request missing a field is rejected', async () => {
    const s = sandbox();
    const reply = await ask({ origin: ORIGIN, path: '/a' }, s.env);
    expect(reply).toMatchObject({ ok: false, code: 'bad-request' });
  });

  test('without a client configuration there is a clear answer', async () => {
    const s = sandbox();
    const reply = await ask(request('/a'), {
      ...s.env,
      NEXTCLOUD_OPEN_LOCAL_CONFIG: join(s.dir, 'none.cfg'),
    });
    expect(reply).toMatchObject({ ok: false, code: 'no-client-config' });
  });

  test('a failing launcher is reported', async () => {
    const s = sandbox();
    touch(join(s.home, 'Nextcloud/a.txt'));
    const reply = await ask(request('/a.txt'), { ...s.env, NEXTCLOUD_OPEN_LOCAL_OPENER: 'false' });
    expect(reply).toMatchObject({ ok: false, code: 'launch-failed' });
  });
});

describe('waiting for a web editor to release its lock', () => {
  const locked = (s: Sandbox) => {
    const file = join(s.home, 'Nextcloud/Docs/locked.docx');
    touch(file);
    chmodSync(file, 0o444);
    return file;
  };
  const launches = (s: Sandbox) => (existsSync(s.opened) ? readFileSync(s.opened, 'utf8') : '');

  test('launches once the read-only copy becomes writable, after reporting the wait', async () => {
    const s = sandbox();
    const file = locked(s);
    setTimeout(() => chmodSync(file, 0o644), 1200);
    const messages = await askAll(request('/Docs/locked.docx', { waitForWritable: true }), {
      ...s.env,
      NEXTCLOUD_OPEN_LOCAL_LOCK_WAIT: '15',
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ status: 'waiting' });
    expect(messages[1]).toEqual({ ok: true, localPath: file });
    expect(launches(s).trim()).toBe(file);
  });

  test('launches anyway at the deadline and says it opened read-only', async () => {
    const s = sandbox();
    const file = locked(s);
    const messages = await askAll(request('/Docs/locked.docx', { waitForWritable: true }), {
      ...s.env,
      NEXTCLOUD_OPEN_LOCAL_LOCK_WAIT: '1',
    });
    expect(messages[0]).toMatchObject({ status: 'waiting' });
    expect(messages[1]).toMatchObject({ ok: true, localPath: file, readOnly: true });
    expect((messages[1] as { message: string }).message).toContain('read-only');
    expect(launches(s).trim()).toBe(file);
    expect((await Bun.file(file).stat()).mode & 0o222).toBe(0);
  });

  test('a writable file is launched at once without any waiting message', async () => {
    const s = sandbox();
    touch(join(s.home, 'Nextcloud/Docs/free.docx'));
    const messages = await askAll(request('/Docs/free.docx', { waitForWritable: true }), s.env);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ ok: true });
  });

  test('a read-only file is not waited for when the request did not leave an editor', async () => {
    const s = sandbox();
    const file = locked(s);
    const messages = await askAll(request('/Docs/locked.docx'), s.env);
    expect(messages).toEqual([{ ok: true, localPath: file }]);
  });
});

describe('install', () => {
  test('writes a manifest for Edge, Chrome and Chromium into the home folder, no root needed', async () => {
    const s = sandbox();
    const home = join(s.dir, 'fakehome');
    const run = Bun.spawnSync(['python3', OPENER, '--install'], {
      env: { PATH: process.env.PATH ?? '', HOME: home },
    });
    expect(run.exitCode).toBe(0);
    const dirs = [
      '.config/microsoft-edge',
      '.config/google-chrome',
      '.config/chromium',
      '.var/app/org.chromium.Chromium/config/chromium',
    ];
    const id = await extensionIdFromKey(buildManifest(pkg.version).key);
    for (const dir of dirs) {
      const manifest = JSON.parse(
        readFileSync(join(home, dir, 'NativeMessagingHosts/nextcloud_open_local.json'), 'utf8'),
      );
      expect(manifest).toMatchObject({
        name: 'nextcloud_open_local',
        type: 'stdio',
        path: OPENER,
        allowed_origins: [`chrome-extension://${id}/`],
      });
    }
  });

  test('uninstall removes what install wrote', () => {
    const s = sandbox();
    const home = join(s.dir, 'fakehome2');
    const env = { PATH: process.env.PATH ?? '', HOME: home };
    Bun.spawnSync(['python3', OPENER, '--install'], { env });
    Bun.spawnSync(['python3', OPENER, '--uninstall'], { env });
    expect(
      existsSync(join(home, '.config/chromium/NativeMessagingHosts/nextcloud_open_local.json')),
    ).toBe(false);
  });

  test('the id the opener allows is the id of the extension key', async () => {
    const source = readFileSync(OPENER, 'utf8');
    const id = /EXTENSION_ID = "([a-p]{32})"/.exec(source)?.[1];
    expect(id).toBe(await extensionIdFromKey(buildManifest(pkg.version).key));
  });
});
