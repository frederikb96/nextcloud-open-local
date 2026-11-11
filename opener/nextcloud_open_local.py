#!/usr/bin/env python3
"""Local opener for the Nextcloud Open Locally browser extension.

Started by the browser through native messaging: reads one request (Nextcloud server, user and
the file's path in Nextcloud), finds the same file in the folder the Nextcloud desktop client keeps
in sync, and hands it to the system's default application. A request that left a web editor waits
first, while the synced copy is read-only because the editor's lock is still being released, and
reports that wait before its final answer. Standard library only.

    nextcloud_open_local.py --install [--extension-id ID]   register with the browsers (no root)
    nextcloud_open_local.py --uninstall                     remove those registrations

Environment overrides (mainly for tests):
    NEXTCLOUD_OPEN_LOCAL_CONFIG     path of the desktop client's nextcloud.cfg
    NEXTCLOUD_OPEN_LOCAL_LOCK_WAIT  seconds to wait for a read-only file to become writable
    NEXTCLOUD_OPEN_LOCAL_OPENER     command that receives the file path, instead of xdg-open / open
"""

import argparse
import json
import os
import re
import shlex
import struct
import subprocess
import sys
import time
from configparser import ConfigParser
from pathlib import Path
from urllib.parse import urlsplit

HOST_NAME = "nextcloud_open_local"
EXTENSION_ID = "ablhojhpkljeiigebanfocmgfnmohdch"

# Files a desktop launcher would run rather than show.
REFUSED_SUFFIXES = {".desktop", ".appimage", ".run", ".exe", ".msi", ".jar", ".bat", ".cmd"}

# How long a request that left a web editor waits for the synced copy to become writable.
DEFAULT_LOCK_WAIT_SECONDS = 60
POLL_SECONDS = 0.5

# Relative to the home directory: where each browser looks for native messaging hosts.
BROWSER_HOST_DIRS = {
    "Edge": ".config/microsoft-edge/NativeMessagingHosts",
    "Chrome": ".config/google-chrome/NativeMessagingHosts",
    "Chromium": ".config/chromium/NativeMessagingHosts",
    "Chromium (flatpak)": ".var/app/org.chromium.Chromium/config/chromium/NativeMessagingHosts",
}


class OpenError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def client_config_candidates():
    override = os.environ.get("NEXTCLOUD_OPEN_LOCAL_CONFIG")
    if override:
        return [Path(override)]
    home = Path.home()
    xdg = Path(os.environ.get("XDG_CONFIG_HOME") or home / ".config")
    return [
        xdg / "Nextcloud" / "nextcloud.cfg",
        home / ".var/app/com.nextcloud.desktopclient.nextcloud/config/Nextcloud/nextcloud.cfg",
        home / "Library/Preferences/Nextcloud/nextcloud.cfg",
    ]


def read_accounts(config_file):
    """Returns the accounts of a nextcloud.cfg as dicts with url, user and folders.

    The client stores one flat [Accounts] section with keys like `0\\url` and
    `0\\Folders\\1\\localPath`: the first number is the account, the second the folder.
    """
    parser = ConfigParser(interpolation=None, delimiters=("=",), strict=False)
    parser.optionxform = str
    parser.read(config_file, encoding="utf-8")
    if not parser.has_section("Accounts"):
        return []
    accounts = {}
    for key, value in parser.items("Accounts"):
        parts = key.split("\\")
        if len(parts) < 2 or not parts[0].isdigit():
            continue
        account = accounts.setdefault(parts[0], {"folders": {}})
        value = value.strip().strip('"')
        if len(parts) == 2:
            account[parts[1]] = value
        elif len(parts) == 4 and parts[1] == "Folders":
            account["folders"].setdefault(parts[2], {})[parts[3]] = value
    return [
        {
            "url": a.get("url", ""),
            "user": a.get("dav_user") or a.get("user") or "",
            "folders": list(a["folders"].values()),
        }
        for a in accounts.values()
    ]


def same_server(a, b):
    def key(url):
        parts = urlsplit(url)
        port = parts.port or {"https": 443, "http": 80}.get(parts.scheme)
        return parts.scheme, (parts.hostname or "").lower(), port

    return key(a) == key(b)


def local_path_for(accounts, origin, user, path):
    """Maps a Nextcloud path to the file in the synced folder; raises OpenError if there is none."""
    parts = path.split("/")
    if not path.startswith("/") or "\0" in path or any(p in ("..", ".") for p in parts):
        raise OpenError("bad-request", f"Unusable path from the browser: {path!r}")

    candidates = [a for a in accounts if same_server(a["url"], origin)]
    if not candidates:
        raise OpenError(
            "no-account", f"The Nextcloud desktop client has no account for {origin}."
        )
    matching = [a for a in candidates if not a["user"] or a["user"].lower() == user.lower()]
    if not matching:
        raise OpenError("no-account", f"The Nextcloud desktop client has no account {user}@{origin}.")
    account = matching[0]

    best = None
    for folder in account["folders"]:
        target = "/" + folder.get("targetPath", "").strip("/")
        local = folder.get("localPath")
        if not local:
            continue
        inside = target == "/" or path == target or path.startswith(target + "/")
        if inside and (best is None or len(target) > len(best[0])):
            best = (target, local)
    if best is None:
        raise OpenError("not-synced", f"{path} is not inside any folder the desktop client syncs.")

    target, local = best
    relative = path[len(target) :].lstrip("/") if target != "/" else path.lstrip("/")
    return Path(local) / relative


def check_local_file(local):
    if local.exists():
        if local.suffix.lower() in REFUSED_SUFFIXES:
            raise OpenError("refused", f"Not opening {local.name}: launchers may run this type.")
        return
    placeholder = local.with_name(local.name + ".nextcloud")
    if placeholder.exists():
        raise OpenError(
            "online-only",
            f"{local.name} is online-only in the desktop client; make it available offline first.",
        )
    raise OpenError(
        "no-local-copy",
        f"{local} does not exist. The desktop client has not synced it (yet), or the folder is excluded.",
    )


def is_writable(local):
    """The desktop client clears the write bits of a file that is locked on the server."""
    return bool(local.stat().st_mode & 0o222)


def wait_until_writable(local, progress):
    """Waits for a locked file to become writable; False when the wait ran out."""
    if is_writable(local):
        return True
    progress(f"Waiting for Nextcloud to release the lock on {local.name}.")
    try:
        limit = float(os.environ.get("NEXTCLOUD_OPEN_LOCAL_LOCK_WAIT", DEFAULT_LOCK_WAIT_SECONDS))
    except ValueError:
        limit = DEFAULT_LOCK_WAIT_SECONDS
    deadline = time.monotonic() + limit
    while time.monotonic() < deadline:
        time.sleep(POLL_SECONDS)
        if is_writable(local):
            return True
    return False


def opener_command(local):
    override = os.environ.get("NEXTCLOUD_OPEN_LOCAL_OPENER")
    if override:
        return [*shlex.split(override), str(local)]
    return ["open" if sys.platform == "darwin" else "xdg-open", str(local)]


def launch(local):
    command = opener_command(local)
    try:
        process = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError as error:
        raise OpenError("launch-failed", f"Could not start {command[0]}: {error}")
    try:
        code = process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        return  # still running: the application took over
    if code != 0:
        raise OpenError("launch-failed", f"{command[0]} exited with status {code}.")


def handle(request, progress):
    for field in ("origin", "user", "path"):
        if not isinstance(request.get(field), str) or not request[field]:
            raise OpenError("bad-request", f"Missing {field} in request.")
    config = next((c for c in client_config_candidates() if c.is_file()), None)
    if config is None:
        raise OpenError("no-client-config", "Found no Nextcloud desktop client configuration.")
    local = local_path_for(read_accounts(config), request["origin"], request["user"], request["path"])
    check_local_file(local)
    writable = True
    if request.get("waitForWritable") is True:
        writable = wait_until_writable(local, progress)
    launch(local)
    reply = {"ok": True, "localPath": str(local)}
    if not writable:
        reply["readOnly"] = True
        reply["message"] = (
            f"{local.name} opened read-only: Nextcloud still has it locked, most likely by a web "
            "editor that is open elsewhere. The desktop client makes it writable again once the lock is gone."
        )
    return reply


def read_message(stream):
    header = stream.read(4)
    if len(header) < 4:
        return None
    (length,) = struct.unpack("<I", header)
    return json.loads(stream.read(length).decode("utf-8"))


def write_message(stream, message):
    data = json.dumps(message).encode("utf-8")
    stream.write(struct.pack("<I", len(data)) + data)
    stream.flush()


def report_waiting(message):
    write_message(sys.stdout.buffer, {"status": "waiting", "message": message})


def serve():
    request = read_message(sys.stdin.buffer)
    if request is None:
        return
    try:
        reply = handle(request, report_waiting)
    except OpenError as error:
        reply = {"ok": False, "code": error.code, "message": error.message}
    except Exception as error:  # the browser must always get an answer
        reply = {"ok": False, "code": "launch-failed", "message": f"Unexpected error: {error}"}
    write_message(sys.stdout.buffer, reply)


def manifest_paths():
    return {
        name: Path.home() / directory / f"{HOST_NAME}.json"
        for name, directory in BROWSER_HOST_DIRS.items()
    }


def install(extension_id):
    script = Path(__file__).resolve()
    script.chmod(script.stat().st_mode | 0o111)
    manifest = {
        "name": HOST_NAME,
        "description": "Opens Nextcloud files from the desktop client's synced folder",
        "path": str(script),
        "type": "stdio",
        "allowed_origins": [f"chrome-extension://{extension_id}/"],
    }
    for name, path in manifest_paths().items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(f"{name}: {path}")


def uninstall():
    for name, path in manifest_paths().items():
        if path.exists():
            path.unlink()
            print(f"{name}: removed {path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--install", action="store_true", help="register the opener with the browsers")
    parser.add_argument("--uninstall", action="store_true", help="remove the registrations")
    parser.add_argument("--extension-id", default=EXTENSION_ID, help="extension allowed to call the opener")
    # The browser starts a native host with the caller's origin as the only argument.
    args, _ = parser.parse_known_args()
    if args.install:
        install(args.extension_id)
    elif args.uninstall:
        uninstall()
    else:
        serve()


if __name__ == "__main__":
    main()
