import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('documentation', () => {
  test('every docs file is linked from the README', () => {
    const readme = read('README.md');
    const docs = readdirSync(join(root, 'docs')).filter((name) => name.endsWith('.md'));
    expect(docs.length).toBeGreaterThan(0);
    for (const doc of docs) expect(readme).toContain(`(docs/${doc})`);
  });

  test('every relative image in the README exists', () => {
    const paths = [...read('README.md').matchAll(/src="(docs\/images\/[^"]+)"/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(() => read(path as string)).not.toThrow();
  });

  test('troubleshooting has a section for every error code of the protocol', () => {
    const protocol = read('src/protocol.ts');
    const codes = [
      ...(/type OpenErrorCode =([^;]+);/.exec(protocol)?.[1] ?? '').matchAll(/'([a-z-]+)'/g),
    ].map((m) => m[1] as string);
    expect(codes.length).toBeGreaterThan(0);
    const troubleshooting = read('docs/troubleshooting.md');
    for (const code of codes) expect(troubleshooting).toContain(`### \`${code}\``);
  });

  test('the protocol lists every error code the opener can send', () => {
    const protocol = read('src/protocol.ts');
    const sent = new Set(
      [...read('opener/nextcloud_open_local.py').matchAll(/OpenError\(\s*"([a-z-]+)"/g)].map(
        (m) => m[1] as string,
      ),
    );
    expect(sent.size).toBeGreaterThan(0);
    for (const code of sent) expect(protocol).toContain(`'${code}'`);
  });

  test('the install guide names every folder the opener registers with', () => {
    const folders = [
      ...read('opener/nextcloud_open_local.py').matchAll(
        /"(\.(?:config|var)\/[^"]+NativeMessagingHosts)"/g,
      ),
    ].map((m) => m[1] as string);
    expect(folders.length).toBeGreaterThan(0);
    const install = read('docs/install.md');
    for (const folder of folders) expect(install).toContain(`~/${folder}`);
  });
});
