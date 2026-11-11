import { describe, expect, test } from 'bun:test';
import { changelogSection, checkRelease, type ReleaseState } from '../scripts/release.ts';

const ID = 'a'.repeat(32);
const CHANGELOG = `# Changelog

## [Unreleased]

## [0.2.0] - 2026-02-01

### Added

- Second thing.

## [0.1.0] - 2026-01-01

### Added

- First thing.
`;

const good: ReleaseState = {
  version: '0.2.0',
  changelog: CHANGELOG,
  opener: `HOST_NAME = "x"\nEXTENSION_ID = "${ID}"\n`,
  extensionId: ID,
  tag: 'v0.2.0',
};

describe('changelogSection', () => {
  test('returns the body between two version headings', () => {
    expect(changelogSection(CHANGELOG, '0.2.0')).toBe('### Added\n\n- Second thing.');
    expect(changelogSection(CHANGELOG, '0.1.0')).toBe('### Added\n\n- First thing.');
  });

  test('is null for a version without a section', () => {
    expect(changelogSection(CHANGELOG, '0.3.0')).toBeNull();
  });
});

describe('checkRelease', () => {
  test('accepts a consistent state, with and without a tag', () => {
    expect(checkRelease(good)).toEqual([]);
    expect(checkRelease({ ...good, tag: undefined })).toEqual([]);
  });

  test('rejects a tag that is not the package version', () => {
    expect(checkRelease({ ...good, tag: 'v0.2.1' })).toHaveLength(1);
  });

  test('rejects a version without a changelog section', () => {
    expect(checkRelease({ ...good, version: '0.3.0', tag: 'v0.3.0' })).toHaveLength(1);
  });

  test('rejects an empty or undated section', () => {
    const empty = CHANGELOG.replace('### Added\n\n- Second thing.\n', '');
    expect(checkRelease({ ...good, changelog: empty })).toHaveLength(1);
    const undated = CHANGELOG.replace('[0.2.0] - 2026-02-01', '[0.2.0]');
    expect(checkRelease({ ...good, changelog: undated })).toHaveLength(1);
  });

  test('rejects an opener that allows another extension id', () => {
    const other = { ...good, opener: `EXTENSION_ID = "${'b'.repeat(32)}"\n` };
    expect(checkRelease(other)).toHaveLength(1);
  });

  test('reports every problem at once', () => {
    const bad = { ...good, version: 'x', tag: 'v1', opener: '' };
    expect(checkRelease(bad).length).toBeGreaterThanOrEqual(4);
  });
});
