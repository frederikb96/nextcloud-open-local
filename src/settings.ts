/** The extension's one option, kept in `chrome.storage.local`. */
export interface Settings {
  /** Navigate the tab from a web editor to the folder view once the local app is being opened. */
  leaveEditor: boolean;
}

export const DEFAULT_SETTINGS: Settings = { leaveEditor: true };

export const SETTINGS_KEY = 'settings';

/** Stored values over the defaults; anything that is not a boolean falls back to the default. */
export function mergeSettings(stored: unknown): Settings {
  const value = (stored as Partial<Settings> | undefined)?.leaveEditor;
  return { leaveEditor: typeof value === 'boolean' ? value : DEFAULT_SETTINGS.leaveEditor };
}
