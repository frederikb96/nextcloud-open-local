# How it works

A click needs two answers: where the file sits in Nextcloud, and where the same file sits on this
computer. The extension answers the first from the page the user is on, the opener answers the
second from the desktop client's own configuration.

## From click to application

- **The page address.** The extension reads the file id out of the address: the Files app
  (`/apps/files/files/<id>?dir=…`, also its sharing view), the permalink (`/f/<id>`) and the
  addresses of the OnlyOffice, Collabora and Text editors (`/apps/<app>/<id>`). An address with a
  `fileid` query parameter on the Files app works too, and so does an installation in a
  sub-folder of the server. Any other page gets a notification asking for a selected file.
- **The signed-in user.** A script runs in the page and reads the account name and the request
  token from the page's own header data, the same values Nextcloud's interface uses.
- **The path.** The extension asks Nextcloud's WebDAV interface, from inside the page and with the
  page's session, which entry of the folder named in the address has that file id (`PROPFIND`,
  depth 1). When the folder is not in the address or does not hold the id, it searches the user's
  whole file tree for the id (`SEARCH`). These two read-only requests are the only ones the
  extension sends, and a unit test fails when the source mentions any other method.
- **Leaving a web editor.** When the page is an editor (an address with `openfile=true`, a
  permalink or an editor app address), the extension points the tab at the Files app's folder
  view with the file selected, once the path is known and before the opener is asked. Closing
  the editor session releases the lock the editor holds on the file in Nextcloud. The tab is
  never closed. The option *Leave the web editor after opening locally* on the extension's
  options page turns this off; it is on by default.
- **The hand-over.** The extension sends the server's address, the user and the path to the opener
  as one native message. Nothing else leaves the browser.
- **The synced copy.** The opener reads the desktop client's `nextcloud.cfg` (the XDG config
  folder, the flatpak client's folder, or the macOS preferences folder) and picks the account
  whose server matches the page and whose user matches the signed-in user. Of that account's
  synced folders it uses the one whose remote path is the longest prefix of the file's path, and
  joins the rest.
- **The wait.** After leaving an editor, the extension asks the opener to wait while the synced
  copy is read-only: the desktop client clears the write permission of a file that is locked on
  the server and sets it again at the sync after the lock is gone. The opener checks the file's
  permissions twice a second for up to a minute and tells the extension, which shows a
  notification while it waits. It never changes the permissions itself. When the minute is up it
  opens the file anyway and the extension says it opened read-only.
- **The launch.** The opener starts `xdg-open` (`open` on macOS) on the file, detached from the
  browser. A launcher that exits with an error within three seconds is reported; one that is
  still running has taken over.

## What the opener refuses

- A path with a `.` or `..` segment, or a NUL character.
- File types a desktop launcher would run instead of show: `.desktop`, `.appimage`, `.run`,
  `.exe`, `.msi`, `.jar`, `.bat` and `.cmd`.

## Permissions

| Permission | Why |
|---|---|
| `activeTab`, `scripting` | read the address data and send the two requests from the tab the user clicked in, for that click only |
| `nativeMessaging` | talk to the opener |
| `notifications` | report a result that needs the user's attention, and show that the opener is waiting for a lock |
| `storage` | keep the last result for the session and the one option |

The extension declares no host permission, so it works on any Nextcloud server without a prompt
and has no access to a page until the user acts on it.

## Environment overrides

The opener reads three variables, which the tests use:

- `NEXTCLOUD_OPEN_LOCAL_CONFIG` is the path of a `nextcloud.cfg` to read instead of the default
  locations.
- `NEXTCLOUD_OPEN_LOCAL_LOCK_WAIT` is the number of seconds the opener waits for a read-only copy to become writable instead of the default minute.
- `NEXTCLOUD_OPEN_LOCAL_OPENER` is a command that receives the file path instead of `xdg-open`.
