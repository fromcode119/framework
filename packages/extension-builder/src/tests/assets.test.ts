import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { gunzipSync } from 'zlib';
import { describe, expect, it } from 'vitest';
import { AssetMinifier } from '@extension-builder/assets/asset-minifier';
import { AssetPrecompressor } from '@extension-builder/assets/asset-precompressor';

function scratch(withTerser: boolean) {
  const root = mkdtempSync(join(tmpdir(), 'assets-'));
  const dir = join(root, 'ui');
  mkdirSync(dir, { recursive: true });
  if (withTerser) {
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(join(root, 'node_modules', '.bin', 'terser'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  }
  return { root, dir };
}

describe('AssetMinifier', () => {
  it('keeps a file unminified rather than losing it when terser fails', async () => {
    const { root, dir } = scratch(true);
    writeFileSync(join(dir, 'broken.js'), 'function (){');
    const result = await AssetMinifier.minify(dir, root);
    expect(readFileSync(join(dir, 'broken.js'), 'utf8')).toBe('function (){');
    expect(existsSync(join(dir, 'broken.js.min.tmp'))).toBe(false);
    expect(result.skippedReason).toContain('broken.js');
  });

  it('says why it skipped when terser is not installed', async () => {
    const { root, dir } = scratch(false);
    writeFileSync(join(dir, 'a.js'), 'const a=1');
    expect((await AssetMinifier.minify(dir, root)).skippedReason).toContain('terser');
  });

  it('minifies many chunks concurrently and keeps every one of them', async () => {
    const { root, dir } = scratch(true);
    for (let i = 0; i < 12; i += 1) writeFileSync(join(dir, `chunk-${i}.js`), 'function (){');
    await AssetMinifier.minify(dir, root);
    for (let i = 0; i < 12; i += 1) {
      expect(existsSync(join(dir, `chunk-${i}.js`)), `chunk-${i}.js must survive`).toBe(true);
      expect(existsSync(join(dir, `chunk-${i}.js.min.tmp`)), 'no temp file may survive').toBe(false);
    }
  });
});

describe('AssetPrecompressor', () => {
  it('writes .gz beside js and css and keeps the original', () => {
    const { dir } = scratch(false);
    writeFileSync(join(dir, 'bundle.js'), 'const a=1;'.repeat(50));
    writeFileSync(join(dir, 'style.css'), '.a{color:red}'.repeat(50));
    expect(AssetPrecompressor.compress(dir).failed).toBe(false);
    expect(existsSync(join(dir, 'bundle.js'))).toBe(true);
    expect(gunzipSync(readFileSync(join(dir, 'bundle.js.gz'))).toString()).toBe('const a=1;'.repeat(50));
    expect(existsSync(join(dir, 'style.css.gz'))).toBe(true);
  });

  it('never compresses a .gz again', () => {
    const { dir } = scratch(false);
    writeFileSync(join(dir, 'bundle.js.gz'), 'already');
    expect(AssetPrecompressor.compress(dir).skippedReason).toBeDefined();
    expect(existsSync(join(dir, 'bundle.js.gz.gz'))).toBe(false);
  });
});
