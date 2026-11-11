import { mergeSettings, SETTINGS_KEY } from '../settings.ts';

const box = document.getElementById('leave-editor') as HTMLInputElement;

const stored = await chrome.storage.local.get(SETTINGS_KEY);
box.checked = mergeSettings(stored[SETTINGS_KEY]).leaveEditor;
box.addEventListener('change', () => {
  void chrome.storage.local.set({ [SETTINGS_KEY]: { leaveEditor: box.checked } });
});
