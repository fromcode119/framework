import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import AdmZip from 'adm-zip';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BackupService } from '@core/management/backup-service';
import { DownloadedArchiveFormat } from '@core/management/downloaded-archive-format';

/**
 * A marketplace streams a package as `application/octet-stream` at an address with no extension; the
 * file name is only in `Content-Disposition`. Reading that zip as a tarball failed every marketplace
 * theme install with "TAR_BAD_ARCHIVE".
 */
describe('a downloaded package is read by its own bytes', () => {
  let server: http.Server;
  let base = '';
  let zip: Buffer;

  beforeAll(async () => {
    const archive = new AdmZip();
    archive.addFile('theme.json', Buffer.from('{"slug":"shop"}'));
    zip = archive.toBuffer();
    server = http.createServer((_request, response) => {
      response.setHeader('Content-Type', 'application/octet-stream');
      response.setHeader('Content-Disposition', 'attachment; filename="shop-0.1.0.zip"');
      response.end(zip);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('extracts a zip served as octet-stream at an address with no extension', async () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-download-zip-'));
    await BackupService.downloadAndExtract(`${base}/api/v1/plugins/marketplace/download-theme/shop`, target);
    expect(fs.readFileSync(path.join(target, 'theme.json'), 'utf8')).toBe('{"slug":"shop"}');
  });

  it('recognises a zip, an empty zip and a gzip by their first bytes, and nothing else', () => {
    expect(DownloadedArchiveFormat.isZip(zip)).toBe(true);
    expect(DownloadedArchiveFormat.isZip(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
    expect(DownloadedArchiveFormat.isZip(Buffer.from([0x1f, 0x8b, 0x08]))).toBe(false);
    expect(DownloadedArchiveFormat.isGzip(Buffer.from([0x1f, 0x8b, 0x08]))).toBe(true);
    expect(DownloadedArchiveFormat.isZip(Buffer.from('PK'))).toBe(false);
    expect(DownloadedArchiveFormat.isGzip(Buffer.alloc(0))).toBe(false);
  });
});
