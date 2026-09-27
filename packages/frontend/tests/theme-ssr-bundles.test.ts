import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ThemeSsrBundles } from '@/lib/ssr/theme-ssr-bundles';

describe('ThemeSsrBundles.stamp', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ssr-bundle-'));
  const entry = join(dir, 'entry.mjs');
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('moves when the file on disk is rebuilt, and holds while it is not', () => {
    writeFileSync(entry, 'export default 1;');
    utimesSync(entry, 1_700_000_000, 1_700_000_000);
    const first = ThemeSsrBundles.stamp(entry);
    expect(ThemeSsrBundles.stamp(entry)).toBe(first);
    writeFileSync(entry, 'export default 2;');
    utimesSync(entry, 1_700_000_100, 1_700_000_100);
    expect(ThemeSsrBundles.stamp(entry)).not.toBe(first);
  });

  it('answers nothing for a bundle that is not there', () => {
    expect(ThemeSsrBundles.stamp(join(dir, 'missing.mjs'))).toBe('');
  });
});
