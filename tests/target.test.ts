import { describe, expect, test } from 'bun:test';
import { parsePageUrl } from '../src/target.ts';

describe('parsePageUrl', () => {
  test('reads the file id and folder of a Files app address', () => {
    expect(
      parsePageUrl('https://cloud.example.org/apps/files/files/4711?dir=/Docs%20x&openfile=true'),
    ).toEqual({
      origin: 'https://cloud.example.org',
      basePath: '',
      fileId: '4711',
      dir: '/Docs x',
    });
  });

  test('keeps the sub-folder of an installation and drops index.php', () => {
    expect(
      parsePageUrl('https://h.example/nextcloud/index.php/apps/files/files/9?dir=/'),
    ).toMatchObject({
      basePath: '/nextcloud',
      fileId: '9',
      dir: '/',
    });
  });

  test('understands the permalink and the editor addresses', () => {
    expect(parsePageUrl('https://h.example/f/12')).toMatchObject({ fileId: '12', dir: null });
    expect(parsePageUrl('https://h.example/index.php/f/12')).toMatchObject({ fileId: '12' });
    expect(parsePageUrl('https://h.example/apps/onlyoffice/34?filePath=%2Fa.docx')).toMatchObject({
      fileId: '34',
    });
  });

  test('accepts the file id as a query parameter of the Files app', () => {
    expect(parsePageUrl('https://h.example/apps/files/?dir=/a&fileid=77')).toMatchObject({
      fileId: '77',
      dir: '/a',
    });
  });

  test('has no file for a folder view, other pages, or garbage', () => {
    expect(parsePageUrl('https://h.example/apps/files/files?dir=/a')).toBeNull();
    expect(parsePageUrl('https://h.example/apps/calendar/')).toBeNull();
    expect(parsePageUrl('chrome://extensions')).toBeNull();
    expect(parsePageUrl('not a url')).toBeNull();
  });
});
