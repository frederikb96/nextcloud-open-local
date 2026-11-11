/** Messages between the extension and the local opener (native messaging, one JSON each way). */
export interface OpenRequest {
  /** Scheme and host of the Nextcloud server, as in the page address. */
  origin: string;
  user: string;
  /** Path below the user's file root, starting with "/". */
  path: string;
}

export type OpenErrorCode =
  | 'no-client-config'
  | 'no-account'
  | 'not-synced'
  | 'no-local-copy'
  | 'online-only'
  | 'refused'
  | 'bad-request'
  | 'launch-failed';

export type OpenReply =
  | { ok: true; localPath: string }
  | { ok: false; code: OpenErrorCode; message: string };
