import { describe, expect, test } from 'bun:test';
import type { DavRequest } from '../src/dav.ts';
import { openCurrentFile, type Ports } from '../src/open.ts';
import type { OpenRequest } from '../src/protocol.ts';

const listing = (id: string, path: string) =>
  `<d:multistatus xmlns:d="DAV:" xmlns:oc="o"><d:response><d:href>/remote.php/dav/files/bob${path}</d:href><d:propstat><d:prop><oc:fileid>${id}</oc:fileid></d:prop></d:propstat></d:response></d:multistatus>`;

function ports(over: Partial<Ports> = {}) {
  const dav: DavRequest[] = [];
  const opened: OpenRequest[] = [];
  const navigated: string[] = [];
  const p: Ports = {
    pageInfo: async () => ({ user: 'bob' }),
    dav: async (req) => {
      dav.push(req);
      return { status: 207, text: listing('5', '/Docs/a.docx') };
    },
    opener: async (req) => {
      opened.push(req);
      return { ok: true, localPath: '/home/u/Nextcloud/Docs/a.docx' };
    },
    navigate: async (url) => {
      navigated.push(url);
    },
    leaveEditor: true,
    waiting: () => {},
    ...over,
  };
  return { p, dav, opened, navigated };
}

const URL_OF_FILE = 'https://cloud.example.org/apps/files/files/5?dir=/Docs';

describe('openCurrentFile', () => {
  test('resolves the path from the folder listing and sends it to the opener', async () => {
    const { p, dav, opened } = ports();
    const outcome = await openCurrentFile(URL_OF_FILE, p);
    expect(outcome).toEqual({
      ok: true,
      path: '/Docs/a.docx',
      localPath: '/home/u/Nextcloud/Docs/a.docx',
    });
    expect(dav.map((r) => r.method)).toEqual(['PROPFIND']);
    expect(opened).toEqual([
      { origin: 'https://cloud.example.org', user: 'bob', path: '/Docs/a.docx' },
    ]);
  });

  test('falls back to a search when the folder does not hold the file', async () => {
    const calls: DavRequest[] = [];
    const { p, opened } = ports({
      dav: async (req) => {
        calls.push(req);
        return req.method === 'PROPFIND'
          ? { status: 404, text: '' }
          : { status: 207, text: listing('5', '/Elsewhere/a.docx') };
      },
    });
    const outcome = await openCurrentFile(URL_OF_FILE, p);
    expect(outcome).toMatchObject({ ok: true, path: '/Elsewhere/a.docx' });
    expect(calls.map((r) => r.method)).toEqual(['PROPFIND', 'SEARCH']);
    expect(opened).toHaveLength(1);
  });

  test('reports a page without a file and never calls the opener', async () => {
    const { p, opened } = ports();
    const outcome = await openCurrentFile('https://cloud.example.org/apps/files/files?dir=/', p);
    expect(outcome).toMatchObject({ ok: false });
    expect(opened).toHaveLength(0);
  });

  test('reports a page that is not signed in to Nextcloud', async () => {
    const { p, opened } = ports({ pageInfo: async () => ({ user: null }) });
    expect(await openCurrentFile(URL_OF_FILE, p)).toMatchObject({ ok: false });
    expect(opened).toHaveLength(0);
  });

  test('reports a failed lookup', async () => {
    const { p, opened } = ports({ dav: async () => ({ status: 500, text: '' }) });
    const outcome = await openCurrentFile(URL_OF_FILE, p);
    expect(outcome).toMatchObject({ ok: false });
    expect(opened).toHaveLength(0);
  });

  test("passes the opener's refusal on as the message", async () => {
    const { p } = ports({
      opener: async () => ({ ok: false, code: 'no-local-copy', message: 'not synced yet' }),
    });
    expect(await openCurrentFile(URL_OF_FILE, p)).toEqual({ ok: false, message: 'not synced yet' });
  });
});

describe('leaving a web editor', () => {
  const EDITOR = 'https://cloud.example.org/apps/files/files/5?dir=/Docs&openfile=true';
  const FOLDER_VIEW = 'https://cloud.example.org/apps/files/files/5?dir=%2FDocs';

  test('navigates to the folder view before the opener runs and asks it to wait', async () => {
    const order: string[] = [];
    const { p, opened, navigated } = ports({
      navigate: async (url) => {
        order.push(`navigate ${url}`);
      },
      opener: async (req) => {
        order.push('opener');
        opened.push(req);
        return { ok: true, localPath: '/x' };
      },
    });
    await openCurrentFile(EDITOR, p);
    expect(order).toEqual([`navigate ${FOLDER_VIEW}`, 'opener']);
    expect(opened[0]?.waitForWritable).toBe(true);
    expect(navigated).toEqual([]);
  });

  test('stays on a plain file listing and does not ask the opener to wait', async () => {
    const { p, opened, navigated } = ports();
    await openCurrentFile(URL_OF_FILE, p);
    expect(navigated).toEqual([]);
    expect(opened[0]?.waitForWritable).toBeUndefined();
  });

  test('stays on the editor when the option is off', async () => {
    const { p, opened, navigated } = ports({ leaveEditor: false });
    await openCurrentFile(EDITOR, p);
    expect(navigated).toEqual([]);
    expect(opened[0]?.waitForWritable).toBeUndefined();
  });

  test('still opens the file when the navigation fails, without waiting', async () => {
    const { p, opened } = ports({
      navigate: async () => {
        throw new Error('tab closed');
      },
    });
    expect(await openCurrentFile(EDITOR, p)).toMatchObject({ ok: true });
    expect(opened[0]?.waitForWritable).toBeUndefined();
  });

  test('does not navigate when the file cannot be resolved', async () => {
    const { p, navigated } = ports({ dav: async () => ({ status: 500, text: '' }) });
    await openCurrentFile(EDITOR, p);
    expect(navigated).toEqual([]);
  });

  test('passes the opener notice about a read-only open on', async () => {
    const { p } = ports({
      opener: async () => ({
        ok: true,
        localPath: '/x',
        readOnly: true,
        message: 'opened read-only',
      }),
    });
    expect(await openCurrentFile(EDITOR, p)).toMatchObject({
      ok: true,
      notice: 'opened read-only',
    });
  });

  test('hands the opener progress to the waiting callback', async () => {
    const seen: string[] = [];
    const { p } = ports({
      waiting: (m) => seen.push(m),
      opener: async (_req, progress) => {
        progress('waiting for the lock');
        return { ok: true, localPath: '/x' };
      },
    });
    await openCurrentFile(EDITOR, p);
    expect(seen).toEqual(['waiting for the lock']);
  });
});
