# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-11

### Added

- Toolbar button and `Alt+Shift+O` shortcut that open the Nextcloud file shown in the browser in the desktop application the system uses for its type, from the copy the Nextcloud desktop client keeps in sync.
- Local opener (native messaging host, Python standard library only) that maps the Nextcloud path to the synced folder and registers itself with Edge, Chrome, Chromium and flatpak Chromium on `--install`.
- Leaving a web editor: when the page is a web editor, the tab returns to the folder view before the file opens, so the editor's lock on the file is released. The opener waits for the read-only synced copy to become writable, shows a notification while it does, and opens the file read-only with a notice when the wait runs out. An options page switch turns the tab change off.
- Notification and badge when there is nothing to open: no matching desktop client account, folder not synced, online-only file, or file not downloaded yet.
