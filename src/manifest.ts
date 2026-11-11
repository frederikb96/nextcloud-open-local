import { EXTENSION_KEY } from './constants.ts';

export function buildManifest(version: string) {
  return {
    manifest_version: 3,
    key: EXTENSION_KEY,
    name: 'Nextcloud Open Locally',
    version,
    description:
      'Opens the Nextcloud file you are viewing in the desktop app your system uses for it, from the synced local copy.',
    icons: { '16': 'icons/icon-16.png', '48': 'icons/icon-48.png', '128': 'icons/icon-128.png' },
    action: { default_title: 'Open this file locally' },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+O' },
        description: 'Open the current Nextcloud file locally',
      },
    },
    background: { service_worker: 'service-worker.js', type: 'module' },
    permissions: ['activeTab', 'scripting', 'nativeMessaging', 'notifications', 'storage'],
  };
}
