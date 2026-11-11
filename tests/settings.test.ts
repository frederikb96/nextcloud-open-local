import { describe, expect, test } from 'bun:test';
import { DEFAULT_SETTINGS, mergeSettings } from '../src/settings.ts';

describe('mergeSettings', () => {
  test('leaves the editor by default', () => {
    expect(DEFAULT_SETTINGS.leaveEditor).toBe(true);
    expect(mergeSettings(undefined)).toEqual({ leaveEditor: true });
  });

  test('keeps a stored choice and ignores anything that is not a boolean', () => {
    expect(mergeSettings({ leaveEditor: false })).toEqual({ leaveEditor: false });
    expect(mergeSettings({ leaveEditor: 'no' })).toEqual({ leaveEditor: true });
  });
});
