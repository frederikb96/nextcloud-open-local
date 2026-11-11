# Development

The extension is TypeScript built with [Bun](https://bun.sh); the opener is one Python file that
uses only the standard library.

```sh
bun install
bun run build         # dist/, the unpacked extension
bun run typecheck && bun run lint && bun run test
bun run test:e2e      # real Chromium, fake Nextcloud, the real opener as native host
bun run package       # nextcloud-open-local.zip of dist/
```

## Tests

- **Unit tests** (`bun run test`) cover the address parsing, the WebDAV requests and their
  parsing, the click flow with injected fakes, the opener over the real native messaging framing
  against a fixture `nextcloud.cfg`, the release checks, and the documentation guards below.
  They also assert that the extension sends only the two read-only requests and asks for no host
  permission.
- **The browser test** (`bun run test:e2e`) loads the built extension into Playwright's bundled
  Chromium, resolves the Nextcloud host name to a local HTTPS server only, registers the real
  opener as native host in the test profile and replaces the desktop application with a stub that
  records the path it receives. It covers the click flow, the tab leaving a web editor, the option, and a locked copy that is released while the opener waits. Branded Chrome and Edge ignore `--load-extension`, so only the
  bundled Chromium runs it; install it with `bunx playwright-core install chromium` if it is
  missing, or point `CHROMIUM_PATH` at another build.
- **Documentation guards** fail when a fact stated in the docs and in the code diverge: every
  `docs/` file is linked from the README, the troubleshooting page has a section for every error
  code of the opener's protocol, and the install guide names every folder the opener registers
  with.

## Pictures

`bun run screenshots` renders `docs/images/hero.png` and `docs/images/no-local-copy.png` from
invented content in `scripts/screenshots/`. Run it after changing what a picture shows.

`docs/images/logo.png` is the source of the extension icons: `scripts/make-icons.sh` writes the
three sizes in `icons/` from it and needs ImageMagick.

## Release

- Raise `version` in `package.json` and move the `[Unreleased]` entries of `CHANGELOG.md` into a
  dated section of that version. This goes through a pull request like any change; the pull
  request checks run `scripts/release.ts check`, which fails when the version, the changelog and
  the extension id the opener allows disagree.
- After the merge, tag the merge commit `vX.Y.Z` and push the tag. The release workflow repeats
  the check against the tag, runs the quality gates, and publishes a GitHub Release whose notes
  are that changelog section, with `nextcloud-open-local.zip` and `nextcloud_open_local.py`
  attached. A tag with a `-` in it is marked as a pre-release.
