# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-11

### Added

- Toolbar button and `Alt+Shift+O` shortcut that open the Nextcloud file shown in the browser in the desktop application the system uses for its type, from the copy the Nextcloud desktop client keeps in sync.
- Local opener (native messaging host, Python standard library only) that maps the Nextcloud path to the synced folder and registers itself with Edge, Chrome, Chromium and flatpak Chromium on `--install`.
- Notification and badge when there is nothing to open: no matching desktop client account, folder not synced, online-only file, or file not downloaded yet.
