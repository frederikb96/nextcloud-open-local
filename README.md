# Nextcloud Open Locally

A browser extension that opens the Nextcloud file you are looking at in the desktop application your system uses for that file type, straight from the copy the Nextcloud desktop client keeps in sync.

One click on the toolbar button, or `Alt+Shift+O`, on a Files page with a file selected (or open in an editor). The extension finds the file's path through Nextcloud's WebDAV interface using the page's own session, a small local helper maps that path to the synced folder, and `xdg-open` launches it. If there is no local copy, you get a notification saying so instead of nothing happening.

## Requirements

- Chrome, Chromium or Edge on Linux
- the Nextcloud desktop client, syncing the folder that holds the file
- `python3` (standard library only)

## Install

```sh
bun install
bun run build                                  # builds dist/
python3 opener/nextcloud_open_local.py --install
```

Then load `dist/` in `chrome://extensions` (`edge://extensions`) with developer mode on and *Load unpacked*. The extension id is fixed by the key in the manifest, which is the one the helper's install step allows.

`--install` writes a native messaging manifest for Edge, Chrome, Chromium and flatpak Chromium into the user's config folders (no root) and points it at `opener/nextcloud_open_local.py`, so keep the repository where it is, or run the command again after moving it. `--uninstall` removes the manifests.

## How the local file is found

The helper reads the desktop client's `nextcloud.cfg` (`~/.config/Nextcloud/`, or the flatpak client's config folder) and picks the account whose server matches the page and whose user matches the signed-in user. Among that account's synced folders it uses the one with the longest matching remote path. It refuses path segments like `..`, and file types a desktop launcher would run rather than show (`.desktop`, `.AppImage`, ...).

If the file is missing it says whether the folder is not synced, the file is online-only (virtual files), or the client has not downloaded it yet.

## Limits

- Linux only: macOS config paths and `open` are in the helper but have not been run; Windows is not supported.
- A browser in a sandbox (flatpak) cannot start a helper outside it.
- Only Files app, permalink (`/f/<id>`) and OnlyOffice/Collabora/Text editor addresses are understood.

## Development

```sh
bun run typecheck && bun run lint && bun run test
bun run test:e2e      # real Chromium, fake Nextcloud, the real helper as native host
bun run package       # nextcloud-open-local.zip of dist/
```

`bun run test:e2e` needs Playwright's bundled Chromium (branded Chrome and Edge ignore `--load-extension`).
