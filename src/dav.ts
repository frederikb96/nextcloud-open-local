/**
 * The only requests this extension sends to Nextcloud: two read-only WebDAV queries that turn a
 * file id into the file's path. Both are built here so one allow-list covers everything.
 */
export interface DavRequest {
  method: 'PROPFIND' | 'SEARCH';
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface DavResponse {
  status: number;
  text: string;
}

export type DavTransport = (request: DavRequest) => Promise<DavResponse>;

const FILE_ID_PROP =
  '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop><oc:fileid/></d:prop></d:propfind>';

function encodePath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function filesRoot(origin: string, basePath: string, user: string): string {
  return `${origin}${basePath}/remote.php/dav/files/${encodeURIComponent(user)}`;
}

/** Lists one folder with the file id of each entry. */
export function listFolder(
  origin: string,
  basePath: string,
  user: string,
  dir: string,
): DavRequest {
  const folder = dir === '/' ? '' : encodePath(dir.replace(/\/+$/, ''));
  return {
    method: 'PROPFIND',
    url: `${filesRoot(origin, basePath, user)}${folder}/`,
    headers: { Depth: '1', 'Content-Type': 'application/xml' },
    body: FILE_ID_PROP,
  };
}

/** Looks a file id up across the user's whole file tree. */
export function searchFileId(
  origin: string,
  basePath: string,
  user: string,
  fileId: string,
): DavRequest {
  const body = `<?xml version="1.0"?><d:searchrequest xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:basicsearch><d:select><d:prop><oc:fileid/></d:prop></d:select><d:from><d:scope><d:href>/files/${escapeXml(user)}</d:href><d:depth>infinity</d:depth></d:scope></d:from><d:where><d:eq><d:prop><oc:fileid/></d:prop><d:literal>${escapeXml(fileId)}</d:literal></d:eq></d:where></d:basicsearch></d:searchrequest>`;
  return {
    method: 'SEARCH',
    url: `${origin}${basePath}/remote.php/dav/`,
    headers: { 'Content-Type': 'text/xml' },
    body,
  };
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export interface DavEntry {
  /** Path below the user's file root, starting with "/". */
  path: string;
  fileId: string;
}

/** Reads href and file id out of a multistatus body; tolerant of any namespace prefix. */
export function parseMultistatus(xml: string, user: string): DavEntry[] {
  const entries: DavEntry[] = [];
  const responses = xml.match(/<(?:\w+:)?response\b[\s\S]*?<\/(?:\w+:)?response>/g) ?? [];
  for (const block of responses) {
    const href = /<(?:\w+:)?href>([^<]*)<\/(?:\w+:)?href>/.exec(block)?.[1];
    const id = /<(?:\w+:)?fileid>(\d+)<\/(?:\w+:)?fileid>/.exec(block)?.[1];
    if (!href || !id) continue;
    const path = pathBelowUserRoot(href, user);
    if (path) entries.push({ path, fileId: id });
  }
  return entries;
}

function pathBelowUserRoot(href: string, user: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(href.startsWith('/') ? href : new URL(href).pathname);
  } catch {
    return null;
  }
  const marker = `/remote.php/dav/files/${user}`;
  const at = pathname.indexOf(marker);
  if (at < 0) return null;
  const rest = pathname.slice(at + marker.length).replace(/\/+$/, '');
  return rest === '' ? '/' : rest;
}
