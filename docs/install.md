# Install

The extension and the local opener are two separate pieces, and both are needed: the extension
finds the file in Nextcloud, the opener starts the application. Both come from the
[latest release](https://github.com/frederikb96/nextcloud-open-local/releases/latest), or from a
checkout of this repository.

## 1. The opener

- Download `nextcloud_open_local.py` from the release, or use `opener/nextcloud_open_local.py`
  from a checkout.
- Put it where it can stay, for example `~/.local/share/nextcloud-open-local/`. The browser starts
  the file at the path it is registered under, so moving it later means running the next command
  again.
- Register it with the browsers. No root is needed:

```sh
python3 nextcloud_open_local.py --install
```

The command writes one native messaging manifest, `nextcloud_open_local.json`, into each of these
folders and prints what it wrote:

| Browser | Folder |
|---|---|
| Edge | `~/.config/microsoft-edge/NativeMessagingHosts` |
| Chrome | `~/.config/google-chrome/NativeMessagingHosts` |
| Chromium | `~/.config/chromium/NativeMessagingHosts` |
| Chromium (flatpak) | `~/.var/app/org.chromium.Chromium/config/chromium/NativeMessagingHosts` |

A manifest names exactly one extension that may start the opener. The default is the id this
extension has in every build, because its manifest carries a fixed key. `--extension-id <id>`
allows a copy that was built with another key instead.

## 2. The extension

- Download `nextcloud-open-local.zip` from the release and unzip it into a folder that stays where
  it is. Or build it from a checkout: `bun install && bun run build` writes `dist/`.
- Open `chrome://extensions` (`edge://extensions` in Edge) and switch on developer mode.
- Choose *Load unpacked* and select the folder that contains `manifest.json`.

The shortcut is `Alt+Shift+O`. If another extension or the browser already holds it, set one at
`chrome://extensions/shortcuts` (`edge://extensions/shortcuts`).

## Option

The extension's options page (its card on the extensions page, *Details*, *Extension options*)
has one switch, *Leave the web editor after opening locally*, on by default. See
[how it works](how-it-works.md) for what it does.

## Check it

Open a file in the Files app, or open it in an editor, and press the toolbar button. The file
opens in the application your system uses for its type. When nothing opens, a notification says
why, and [troubleshooting](troubleshooting.md) lists each message.

## Update

Replace the contents of the extension's folder with the new release and press *Reload* on its card
on the extensions page. Replace the opener file in place; the registration keeps pointing at it.

## Uninstall

`python3 nextcloud_open_local.py --uninstall` removes the manifests, and *Remove* on the
extension's card removes the extension.
