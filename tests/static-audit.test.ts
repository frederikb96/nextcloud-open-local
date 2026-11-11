import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import { buildManifest } from '../src/manifest.ts';

const src = resolve(import.meta.dir, '..', 'src');
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : e.name.endsWith('.ts')
        ? [join(dir, e.name)]
        : [],
  );

describe('read-only guarantee', () => {
  test('the only request methods in the extension are the two lookups', () => {
    for (const file of sources(src)) {
      const text = readFileSync(file, 'utf8');
      for (const verb of ['PUT', 'DELETE', 'POST', 'MOVE', 'COPY', 'PROPPATCH', 'MKCOL', 'LOCK']) {
        expect(text.includes(`'${verb}'`) || text.includes(`"${verb}"`)).toBe(false);
      }
    }
  });

  test('the page-side request goes only through the request objects of the allow-listed builders', () => {
    const worker = readFileSync(join(src, 'extension/service-worker.ts'), 'utf8');
    expect(worker.match(/\bfetch\(/g)).toHaveLength(1);
  });
});

describe('manifest', () => {
  const manifest = buildManifest(pkg.version);

  test('asks for no host permission: the page is reached through the click only', () => {
    expect(manifest).not.toHaveProperty('host_permissions');
    expect(manifest).not.toHaveProperty('optional_host_permissions');
    expect([...manifest.permissions].sort()).toEqual([
      'activeTab',
      'nativeMessaging',
      'notifications',
      'scripting',
      'storage',
    ]);
  });

  test('is Manifest V3 with a module service worker and the version from package.json', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.background).toEqual({ service_worker: 'service-worker.js', type: 'module' });
  });
});
