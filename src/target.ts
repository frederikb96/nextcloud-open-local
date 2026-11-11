/** What the address of a Nextcloud page says about the file the user is looking at. */
export interface PageTarget {
  /** Scheme and host of the server. */
  origin: string;
  /** Path prefix of the installation (empty unless Nextcloud lives in a sub-folder). */
  basePath: string;
  fileId: string;
  /** The folder shown in the Files app, when the address names one. */
  dir: string | null;
  /** The page is a web editor (or opens the file in one), not a plain file listing. */
  editor: boolean;
}

// Files app (also its sharing view), permalink, and the editor integrations' address forms.
const FILE_ID_PATTERNS = [
  { pattern: /^(.*?)\/apps\/files(?:_sharing)?\/(?:files\/)?(\d+)(?:\/|$)/, editor: false },
  { pattern: /^(.*?)\/(?:index\.php\/)?f\/(\d+)(?:\/|$)/, editor: true },
  { pattern: /^(.*?)\/apps\/(?:onlyoffice|richdocuments|text)\/(\d+)(?:\/|$)/, editor: true },
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
  for (const { pattern, editor } of FILE_ID_PATTERNS) {
    const match = pattern.exec(pathname);
    if (match?.[2]) return build(url, match[1] ?? '', match[2], editor);
  }
  const queryId = url.searchParams.get('fileid') ?? url.searchParams.get('fileId');
  const base = /^(.*?)\/apps\/files\b/.exec(pathname);
  if (base && queryId && /^\d+$/.test(queryId)) return build(url, base[1] ?? '', queryId, false);
  return null;
}

function build(url: URL, basePath: string, fileId: string, editor: boolean): PageTarget {
  const openfile = url.searchParams.get('openfile');
  return {
    origin: url.origin,
    basePath,
    fileId,
    dir: url.searchParams.get('dir'),
    editor: editor || openfile === 'true' || openfile === '1',
  };
}

/** The Files app listing of the folder that holds the file, with the file selected but not opened. */
export function folderViewUrl(target: PageTarget, path: string): string {
  const folder = path.slice(0, path.lastIndexOf('/')) || '/';
  return `${target.origin}${target.basePath}/apps/files/files/${target.fileId}?dir=${encodeURIComponent(folder)}`;
}
