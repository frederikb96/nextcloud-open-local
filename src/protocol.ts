/** Messages between the extension and the local opener (native messaging, one JSON each way). */
export interface OpenRequest {
  /** Scheme and host of the Nextcloud server, as in the page address. */
  origin: string;
  user: string;
  /** Path below the user's file root, starting with "/". */
  path: string;
  /**
   * Set when the extension has just left a web editor: the editor's lock on the file is being
   * released, so the opener waits for the synced copy to become writable before it launches.
   */
  waitForWritable?: boolean;
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

/** Sent while the opener waits, before its final reply. */
export interface OpenProgress {
  status: 'waiting';
  message: string;
}

export type OpenReply =
  | {
      ok: true;
      localPath: string;
      /** Set when the file was still read-only at the end of the wait; `message` says why. */
      readOnly?: boolean;
      message?: string;
    }
  | { ok: false; code: OpenErrorCode; message: string };
