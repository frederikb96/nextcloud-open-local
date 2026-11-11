import { type DavTransport, listFolder, parseMultistatus, searchFileId } from './dav.ts';
import type { PageTarget } from './target.ts';

export class ResolveError extends Error {}

/** Finds the Nextcloud path of the page's file: the folder listing first, a tree search second. */
export async function resolveFilePath(
  target: PageTarget,
  user: string,
  dav: DavTransport,
): Promise<string> {
  const { origin, basePath, fileId, dir } = target;
  if (dir) {
    const reply = await dav(listFolder(origin, basePath, user, dir));
    if (reply.status === 207) {
      const hit = parseMultistatus(reply.text, user).find((e) => e.fileId === fileId);
      if (hit) return hit.path;
    }
  }
  const reply = await dav(searchFileId(origin, basePath, user, fileId));
  if (reply.status !== 207) {
    throw new ResolveError(`Nextcloud could not look up file ${fileId} (HTTP ${reply.status}).`);
  }
  const hit = parseMultistatus(reply.text, user).find((e) => e.fileId === fileId);
  if (!hit) throw new ResolveError(`Nextcloud has no file ${fileId} for ${user}.`);
  return hit.path;
}
