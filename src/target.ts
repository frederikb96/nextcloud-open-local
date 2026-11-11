/** What the address of a Nextcloud page says about the file the user is looking at. */
export interface PageTarget {
  /** Scheme and host of the server. */
  origin: string;
  /** Path prefix of the installation (empty unless Nextcloud lives in a sub-folder). */
  basePath: string;
  fileId: string;
  /** The folder shown in the Files app, when the address names one. */
  dir: string | null;
}

// Files app (also its sharing view), permalink, and the editor integrations' address forms.
const FILE_ID_PATTERNS = [
  /^(.*?)\/apps\/files(?:_sharing)?\/(?:files\/)?(\d+)(?:\/|$)/,
  /^(.*?)\/(?:index\.php\/)?f\/(\d+)(?:\/|$)/,
  /^(.*?)\/apps\/(?:onlyoffice|richdocuments|text)\/(\d+)(?:\/|$)/,
];

export function parsePageUrl(raw: string): PageTarget | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const pathname = url.pathname.replace(/\/index\.php(?=\/)/, '');
  for (const pattern of FILE_ID_PATTERNS) {
    const match = pattern.exec(pathname);
    if (match?.[2]) return build(url, match[1] ?? '', match[2]);
  }
  const queryId = url.searchParams.get('fileid') ?? url.searchParams.get('fileId');
  const base = /^(.*?)\/apps\/files\b/.exec(pathname);
  if (base && queryId && /^\d+$/.test(queryId)) return build(url, base[1] ?? '', queryId);
  return null;
}

function build(url: URL, basePath: string, fileId: string): PageTarget {
  return { origin: url.origin, basePath, fileId, dir: url.searchParams.get('dir') };
}
