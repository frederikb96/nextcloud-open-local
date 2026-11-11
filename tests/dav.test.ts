import { describe, expect, test } from 'bun:test';
import { listFolder, parseMultistatus, searchFileId } from '../src/dav.ts';

const MULTISTATUS = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
 <d:response><d:href>/remote.php/dav/files/bob/Docs/</d:href><d:propstat><d:prop><oc:fileid>10</oc:fileid></d:prop></d:propstat></d:response>
 <d:response><d:href>/remote.php/dav/files/bob/Docs/Q1%20Report%20%C3%A4.docx</d:href><d:propstat><d:prop><oc:fileid>11</oc:fileid></d:prop></d:propstat></d:response>
 <d:response><d:href>/remote.php/dav/files/bob/Docs/no-id.txt</d:href></d:response>
</d:multistatus>`;

describe('parseMultistatus', () => {
  test('returns decoded paths below the user root with their file ids', () => {
    expect(parseMultistatus(MULTISTATUS, 'bob')).toEqual([
      { path: '/Docs', fileId: '10' },
      { path: '/Docs/Q1 Report ä.docx', fileId: '11' },
    ]);
  });

  test('ignores entries of another user and tolerates other prefixes and sub-folder installs', () => {
    const xml =
      '<D:multistatus xmlns:D="DAV:" xmlns:o="x"><D:response><D:href>/nc/remote.php/dav/files/other/a</D:href><o:fileid>1</o:fileid></D:response><D:response><D:href>/nc/remote.php/dav/files/bob/b</D:href><o:fileid>2</o:fileid></D:response></D:multistatus>';
    expect(parseMultistatus(xml, 'bob')).toEqual([{ path: '/b', fileId: '2' }]);
  });
});

describe('request builders', () => {
  test('list the folder with Depth 1 and encode each segment', () => {
    const req = listFolder('https://h.example', '/nc', 'bob', '/Docs x/ü/');
    expect(req.method).toBe('PROPFIND');
    expect(req.url).toBe('https://h.example/nc/remote.php/dav/files/bob/Docs%20x/%C3%BC/');
    expect(req.headers.Depth).toBe('1');
  });

  test('list the root', () => {
    expect(listFolder('https://h.example', '', 'bob', '/').url).toBe(
      'https://h.example/remote.php/dav/files/bob/',
    );
  });

  test('search by file id in the user tree, escaping the user', () => {
    const req = searchFileId('https://h.example', '', 'a<b', '42');
    expect(req.method).toBe('SEARCH');
    expect(req.url).toBe('https://h.example/remote.php/dav/');
    expect(req.body).toContain('<d:literal>42</d:literal>');
    expect(req.body).toContain('/files/a&#60;b');
  });
});
