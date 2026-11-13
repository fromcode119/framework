import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { IntegrityService } from '@core/security/integrity-service';

function extensionDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'integrity-'));
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify({ slug: 'demo', checksum: 'stale' }, null, 2)}\n`);
  writeFileSync(join(dir, 'index.js'), 'module.exports = {};');
  return dir;
}

describe('IntegrityService on a source checkout', () => {
  it('verifies an installed directory against its checksum', async () => {
    const dir = extensionDir();
    expect(await IntegrityService.verifyPluginIntegrity(dir, 'stale')).toBe(false);
    expect(await IntegrityService.verifyPluginIntegrity(dir, await IntegrityService.calculateDirectoryHash(dir))).toBe(true);
  });

  it('does not verify a checkout: the committed checksum can never match a local build', async () => {
    const clone = extensionDir();
    mkdirSync(join(clone, '.git'));
    const worktree = extensionDir();
    writeFileSync(join(worktree, '.git'), 'gitdir: /somewhere/else');

    expect(await IntegrityService.verifyPluginIntegrity(clone, 'stale')).toBe(true);
    expect(await IntegrityService.verifyPluginIntegrity(worktree, 'stale')).toBe(true);
  });

  it('re-stamps an installed directory and never writes into a checkout', async () => {
    const installed = extensionDir();
    const stamp = await IntegrityService.restampPlugin(installed);
    expect(JSON.parse(readFileSync(join(installed, 'manifest.json'), 'utf8')).checksum).toBe(stamp);

    const checkout = extensionDir();
    mkdirSync(join(checkout, '.git'));
    const before = readFileSync(join(checkout, 'manifest.json'), 'utf8');
    expect(await IntegrityService.restampPlugin(checkout)).toBe(stamp);
    expect(readFileSync(join(checkout, 'manifest.json'), 'utf8')).toBe(before);
  });
});
