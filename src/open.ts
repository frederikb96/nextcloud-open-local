import type { DavTransport } from './dav.ts';
import type { OpenReply, OpenRequest } from './protocol.ts';
import { resolveFilePath } from './resolve.ts';
import { folderViewUrl, parsePageUrl } from './target.ts';

export interface PageInfo {
  /** Nextcloud account name of the signed-in user, when the page is a Nextcloud page. */
  user: string | null;
}

export interface Ports {
  pageInfo: () => Promise<PageInfo>;
  dav: DavTransport;
  /**
   * Sends the request to the local opener and returns its final answer; `progress` receives what
   * the opener says while it waits.
   */
  opener: (request: OpenRequest, progress: (message: string) => void) => Promise<OpenReply>;
  /** Points the tab at another address. */
  navigate: (url: string) => Promise<void>;
  /** Whether a web editor is left for the folder view once the file is being opened. */
  leaveEditor: boolean;
  /** Shows the user what the opener is waiting for. */
  waiting: (message: string) => void;
}

export type Outcome =
  | { ok: true; path: string; localPath: string; notice?: string }
  | { ok: false; message: string };

/** Everything between the click and the opener, with the browser's parts injected. */
export async function openCurrentFile(pageUrl: string, ports: Ports): Promise<Outcome> {
  const target = parsePageUrl(pageUrl);
  if (!target) {
    return { ok: false, message: 'Select a file in the Nextcloud Files app first.' };
  }
  const { user } = await ports.pageInfo();
  if (!user) return { ok: false, message: 'This does not look like a signed-in Nextcloud page.' };
  let path: string;
  try {
    path = await resolveFilePath(target, user, ports.dav);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  // A web editor holds a lock on the file until its session ends; leaving it first lets the lock
  // go while the opener waits for the synced copy to become writable.
  let left = false;
  if (target.editor && ports.leaveEditor) {
    try {
      await ports.navigate(folderViewUrl(target, path));
      left = true;
    } catch {
      // The page stays; the file still opens, possibly read-only.
    }
  }
  const request: OpenRequest = { origin: target.origin, user, path };
  if (left) request.waitForWritable = true;
  const reply = await ports.opener(request, ports.waiting);
  if (!reply.ok) return { ok: false, message: reply.message };
  return {
    ok: true,
    path,
    localPath: reply.localPath,
    ...(reply.readOnly && reply.message ? { notice: reply.message } : {}),
  };
}
