import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { OpenReply } from '../../src/protocol.ts';

export const OPENER = resolve(import.meta.dir, '..', '..', 'opener', 'nextcloud_open_local.py');
const FIXTURE = resolve(import.meta.dir, '..', 'fixtures', 'nextcloud.cfg');

export interface Sandbox {
  dir: string;
  /** A synced folder root; the fixture config's `/home/user` is rewritten to it. */
  home: string;
  config: string;
  /** Command stub that appends each path it receives to this file. */
  opened: string;
  openerStub: string;
  env: Record<string, string>;
}

export function makeSandbox(configText = readFileSync(FIXTURE, 'utf8')): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), 'nc-open-test-'));
  const home = join(dir, 'home');
  mkdirSync(home);
  const config = join(dir, 'nextcloud.cfg');
  writeFileSync(config, configText.replaceAll('/home/user', home));
  const opened = join(dir, 'opened.txt');
  const openerStub = join(dir, 'stub-open.sh');
  writeFileSync(openerStub, `#!/bin/sh\nprintf '%s\\n' "$1" >> '${opened}'\n`);
  chmodSync(openerStub, 0o755);
  return {
    dir,
    home,
    config,
    opened,
    openerStub,
    env: { NEXTCLOUD_OPEN_LOCAL_CONFIG: config, NEXTCLOUD_OPEN_LOCAL_OPENER: openerStub },
  };
}

export function touch(path: string) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, 'x');
}

/** Speaks the native messaging framing to the opener, like the browser does. */
export async function ask(request: unknown, env: Record<string, string>): Promise<OpenReply> {
  const body = Buffer.from(JSON.stringify(request));
  const frame = Buffer.alloc(4 + body.length);
  frame.writeUInt32LE(body.length, 0);
  body.copy(frame, 4);
  const proc = Bun.spawn(['python3', OPENER, 'chrome-extension://x/'], {
    stdin: new Blob([frame]),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { PATH: process.env.PATH ?? '', HOME: env.HOME ?? process.env.HOME ?? '', ...env },
  });
  const out = Buffer.from(await new Response(proc.stdout).arrayBuffer());
  await proc.exited;
  return JSON.parse(out.subarray(4, 4 + out.readUInt32LE(0)).toString('utf8'));
}
