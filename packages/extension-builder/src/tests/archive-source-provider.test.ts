import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ArchiveSourceProvider } from '@extension-builder/sources/archive-source-provider';

describe('ArchiveSourceProvider', () => {
  it('accepts the archive shapes an operator can actually hand us', () => {
    const dir = mkdtempSync(join(tmpdir(), 'archive-src-'));
    for (const name of ['a.zip', 'b.tar.gz', 'c.tgz']) {
      const file = join(dir, name);
      writeFileSync(file, 'x');
      expect(ArchiveSourceProvider.assertAllowed(file)).toBe(file);
    }
  });

  it('refuses a path that is not an archive we accept', () => {
    const dir = mkdtempSync(join(tmpdir(), 'archive-src-'));
    const file = join(dir, 'payload.sh');
    writeFileSync(file, 'x');
    expect(() => ArchiveSourceProvider.assertAllowed(file)).toThrow(/must end in/);
  });

  it('refuses a file that does not exist rather than failing later', () => {
    expect(() => ArchiveSourceProvider.assertAllowed('/nope/missing.zip')).toThrow(/not a readable file/);
  });

  it('refuses an empty path', () => {
    expect(() => ArchiveSourceProvider.assertAllowed('')).toThrow(/no path given/);
  });
});
