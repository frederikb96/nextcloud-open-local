# Troubleshooting

When nothing opens, the extension shows a notification and a red `!` on its button. The text of
the notification is the message listed under each heading; the code in the heading is what the
opener reports for it. Failures that happen before the opener is reached have no code.

## Before the opener

### Select a file in the Nextcloud Files app first

The address of the tab holds no file id. Select a file in the Files app or open one in an editor,
and press the button again.

### This does not look like a signed-in Nextcloud page

The page does not carry the signed-in user's header data. Sign in, or reload the page.

### Nextcloud could not look up file … / Nextcloud has no file … for …

The server answered the WebDAV lookup with an error status, or found no file with that id in the
signed-in user's tree. Reload the page first, in case the file changed since it loaded. A status
code in the message comes from the server, so a rejected `PROPFIND` or `SEARCH` request shows up
there.

### The local opener is not reachable

The browser could not start the opener. Run `--install` again, as described in the
[install guide](install.md), and check that the file still sits at the path the manifest names. A
browser that runs in a sandbox, such as a flatpak, cannot start a program outside it; the opener
needs a browser installed the usual way.

## From the opener

### `no-client-config`

The opener found no `nextcloud.cfg`. It looks in the XDG config folder, in the flatpak client's
folder, and in the macOS preferences folder. Install the Nextcloud desktop client and sign in
there, or point `NEXTCLOUD_OPEN_LOCAL_CONFIG` at the file.

### `no-account`

The desktop client has no account for this server and user. The address and the user have to
match the account the client is signed in with; a server reached under a second name does not.

### `not-synced`

The file's path is not inside any folder the client syncs. Add a sync connection for a folder
that contains it in the desktop client.

### `online-only`

The client keeps this file as a placeholder and has not downloaded it. Make it available
offline in the desktop client, then try again.

### `no-local-copy`

The synced copy does not exist. The client has not downloaded the file yet, or excludes its
folder from syncing. The notification names the path it looked at.

### `refused`

The file type is one a desktop launcher could run instead of display. The opener never starts
these; open the file by hand if it is safe.

### `bad-request`

The request held a path with a `.` or `..` segment, a NUL character, or a missing field. The
extension sends well-formed requests, so this should not happen in normal use.

### `launch-failed`

`xdg-open` could not be started, or it exited with an error within three seconds. Check that
`xdg-open file.ext` works in a terminal for the same file type.
