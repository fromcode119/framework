import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { SourcePackagePublication } from '@sources/packaging/source-package-publication';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';

describe('SourcePackagePublication', () => {
  const identity = BuildSourceIdentity.parse('plugin', 'demo');
  const pkg = { version: '1.2.0', manifest: { name: 'Demo', description: 'A demo', author: { name: 'Studio' } } };
  const archiveFile = () => {
    const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'publish-')), 'demo-1.2.0.zip');
    fs.writeFileSync(filePath, 'zip bytes');
    return { filePath, fileName: 'demo-1.2.0.zip' };
  };

  it('hands the archive and what the manifest says to the site, with the archive digest', async () => {
    const archive = archiveFile();
    const publisher = { isSite: vi.fn(async () => true), publish: vi.fn(async () => '42') };
    const outcome = await new SourcePackagePublication(async () => archive, publisher).publish(identity, 'mkt', pkg);

    expect(outcome).toMatch(/^Published 1\.2\.0 to "mkt"/);
    expect(publisher.publish).toHaveBeenCalledWith('mkt', archive, {
      type: 'plugin', slug: 'demo', version: '1.2.0', name: 'Demo', description: 'A demo', author: 'Studio',
      artifactSha256: crypto.createHash('sha256').update('zip bytes').digest('hex'),
    });
  });

  it('says so, and publishes nothing, for a site that does not exist', async () => {
    const publisher = { isSite: vi.fn(async () => false), publish: vi.fn() };
    const outcome = await new SourcePackagePublication(async () => archiveFile(), publisher).publish(identity, 'gone', pkg);
    expect(outcome).toMatch(/no active site/);
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('reports a failed hand-over instead of throwing — the build itself still succeeded', async () => {
    const publisher = { isSite: vi.fn(async () => true), publish: vi.fn(async () => { throw new Error('disk full'); }) };
    await expect(new SourcePackagePublication(async () => archiveFile(), publisher).publish(identity, 'mkt', pkg))
      .resolves.toMatch(/Not published to "mkt".*disk full/);
  });

  it('says it cannot publish when the installation has no publisher', async () => {
    await expect(new SourcePackagePublication(async () => archiveFile()).publish(identity, 'mkt', pkg))
      .resolves.toMatch(/cannot publish to sites/);
  });
});
