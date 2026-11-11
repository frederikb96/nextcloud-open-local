import type { DavTransport } from './dav.ts';
import type { OpenReply, OpenRequest } from './protocol.ts';
import { resolveFilePath } from './resolve.ts';
import { parsePageUrl } from './target.ts';

export interface PageInfo {
  /** Nextcloud account name of the signed-in user, when the page is a Nextcloud page. */
  user: string | null;
}

export interface Ports {
  pageInfo: () => Promise<PageInfo>;
  dav: DavTransport;
  /** Sends the request to the local opener and returns its answer. */
  opener: (request: OpenRequest) => Promise<OpenReply>;
}

export type Outcome =
  | { ok: true; path: string; localPath: string }
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
  const reply = await ports.opener({ origin: target.origin, user, path });
  return reply.ok
    ? { ok: true, path, localPath: reply.localPath }
    : { ok: false, message: reply.message };
}
