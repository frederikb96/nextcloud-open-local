import { describe, expect, test } from 'bun:test';
import { folderViewUrl, type PageTarget, parsePageUrl } from '../src/target.ts';

describe('parsePageUrl', () => {
  test('reads the file id and folder of a Files app address', () => {
    expect(
      parsePageUrl('https://cloud.example.org/apps/files/files/4711?dir=/Docs%20x&openfile=true'),
    ).toEqual({
      origin: 'https://cloud.example.org',
      basePath: '',
      fileId: '4711',
      dir: '/Docs x',
      editor: true,
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

describe('editor pages', () => {
  test('a plain Files listing is not an editor, openfile makes it one', () => {
    expect(parsePageUrl('https://h.example/apps/files/files/7?dir=/a')).toMatchObject({
      editor: false,
    });
    expect(parsePageUrl('https://h.example/apps/files/files/7?dir=/a&openfile=true')).toMatchObject(
      { editor: true },
    );
    expect(
      parsePageUrl('https://h.example/apps/files/files/7?dir=/a&openfile=false'),
    ).toMatchObject({ editor: false });
  });

  test('permalinks and editor apps are editors', () => {
    expect(parsePageUrl('https://h.example/f/12')).toMatchObject({ editor: true });
    expect(parsePageUrl('https://h.example/apps/richdocuments/34')).toMatchObject({ editor: true });
  });
});

describe('folderViewUrl', () => {
  const target = parsePageUrl('https://h.example/nextcloud/f/12') as PageTarget;

  test('selects the file inside its folder without opening it', () => {
    expect(folderViewUrl(target, '/Docs x/a.docx')).toBe(
      'https://h.example/nextcloud/apps/files/files/12?dir=%2FDocs%20x',
    );
  });

  test('uses the root for a file at the top', () => {
    expect(folderViewUrl(target, '/a.docx')).toBe(
      'https://h.example/nextcloud/apps/files/files/12?dir=%2F',
    );
  });
});
