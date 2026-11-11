#!/usr/bin/env bun
/**
 * Release guards and notes.
 *
 *   bun run scripts/release.ts check [vX.Y.Z]   every place that states the version agrees
 *   bun run scripts/release.ts notes vX.Y.Z     the CHANGELOG section of that version
 *
 * `check` without a tag runs in the pull-request checks, so a half-done version bump fails before
 * the merge; with a tag it is the first step of the release workflow.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import { EXTENSION_KEY } from '../src/constants.ts';
import { extensionIdFromKey } from '../tests/helpers/extension-id.ts';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const HEADING = /^##\s+\[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/;

/** The body of the CHANGELOG section for a version, or null when there is none. */
export function changelogSection(changelog: string, version: string): string | null {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => HEADING.exec(line)?.[1] === version);
  if (start < 0) return null;
  const length = lines.slice(start + 1).findIndex((line) => HEADING.test(line));
  const end = length < 0 ? lines.length : start + 1 + length;
  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
}

export interface ReleaseState {
  version: string;
  changelog: string;
  /** Source of the opener, which names the extension id it allows. */
  opener: string;
  /** The id Chromium derives from the manifest's key. */
  extensionId: string;
  tag?: string;
}

/** Every disagreement found, not only the first. */
export function checkRelease(state: ReleaseState): string[] {
  const problems: string[] = [];
  if (!SEMVER.test(state.version)) {
    problems.push(`package.json version "${state.version}" is not a semantic version`);
  }
  if (state.tag !== undefined && state.tag !== `v${state.version}`) {
    problems.push(`tag ${state.tag} does not match package.json version ${state.version}`);
  }
  const section = changelogSection(state.changelog, state.version);
  if (section === null) {
    problems.push(`CHANGELOG.md has no "## [${state.version}] - YYYY-MM-DD" section`);
  } else if (section === '') {
    problems.push(`CHANGELOG.md section for ${state.version} is empty`);
  }
  const dated = state.changelog
    .split('\n')
    .map((line) => HEADING.exec(line))
    .find((match) => match?.[1] === state.version);
  if (dated && !dated[2]) {
    problems.push(`CHANGELOG.md section for ${state.version} has no date`);
  }
  const openerId = /^EXTENSION_ID = "([a-p]{32})"/m.exec(state.opener)?.[1];
  if (openerId !== state.extensionId) {
    problems.push(
      `the opener allows extension id ${openerId ?? '(none found)'}, but the manifest key derives ${state.extensionId}`,
    );
  }
  return problems;
}

async function main() {
  const [command, tag] = process.argv.slice(2);
  const root = resolve(import.meta.dir, '..');
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');

  if (command === 'notes') {
    const body = tag ? changelogSection(changelog, tag.replace(/^v/, '')) : null;
    if (!body) {
      console.error(`CHANGELOG.md has no filled section for ${tag ?? '(no tag given)'}`);
      process.exit(1);
    }
    console.log(body);
    return;
  }

  if (command === 'check') {
    const problems = checkRelease({
      version: pkg.version,
      changelog,
      opener: readFileSync(join(root, 'opener', 'nextcloud_open_local.py'), 'utf8'),
      extensionId: await extensionIdFromKey(EXTENSION_KEY),
      tag,
    });
    if (problems.length > 0) {
      for (const problem of problems) console.error(`- ${problem}`);
      process.exit(1);
    }
    console.log(`Release state is consistent for ${pkg.version}${tag ? ` (${tag})` : ''}`);
    return;
  }

  console.error('Usage: release.ts check [vX.Y.Z] | notes vX.Y.Z');
  process.exit(2);
}

if (import.meta.main) await main();
