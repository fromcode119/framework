import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginArchiveSupport } from '../src/controllers/plugins/plugin-archive-support';

/**
 * A plugin's built UI assets live in its `ui/` DIST directory. The build used to emit them into the
 * `src/ui/` SOURCE tree and mirror the result to `ui/`, so every package shipped both copies and the
 * source tree carried build output beside its components. `ui/` is now the only place the build
 * writes — but plugins installed before that change have their bundles solely in `src/ui/`, and they
 * must keep serving until they are repacked.
 */
describe('PluginArchiveSupport.resolveUiAsset', () => {
  const created: string[] = [];

  function makePlugin(files: string[]): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-plugin-ui-'));
    created.push(root);
    for (const file of files) {
      const target = path.join(root, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file);
    }
    return root;
  }

  afterEach(() => {
    while (created.length) fs.rmSync(created.pop() as string, { recursive: true, force: true });
  });

  it('serves from the dist directory', () => {
    const root = makePlugin(['ui/bundle.js']);
    expect(PluginArchiveSupport.resolveUiAsset(root, 'bundle.js')).toBe(path.join(root, 'ui', 'bundle.js'));
  });

  it('falls back to src/ui for a plugin installed before the build moved', () => {
    const root = makePlugin(['src/ui/bundle.js']);
    expect(PluginArchiveSupport.resolveUiAsset(root, 'bundle.js')).toBe(path.join(root, 'src', 'ui', 'bundle.js'));
  });

  it('prefers dist when a half-migrated install carries both', () => {
    const root = makePlugin(['ui/bundle.js', 'src/ui/bundle.js']);
    expect(PluginArchiveSupport.resolveUiAsset(root, 'bundle.js')).toBe(path.join(root, 'ui', 'bundle.js'));
  });

  it('resolves nested assets', () => {
    const root = makePlugin(['ui/chunks/vendor.js']);
    expect(PluginArchiveSupport.resolveUiAsset(root, 'chunks/vendor.js')).toBe(path.join(root, 'ui', 'chunks', 'vendor.js'));
  });

  it('returns the dist path for a missing file, so the caller 404s on the canonical location', () => {
    const root = makePlugin([]);
    expect(PluginArchiveSupport.resolveUiAsset(root, 'bundle.js')).toBe(path.join(root, 'ui', 'bundle.js'));
  });

  /**
   * The containment check is the whole security value of this function: the path segment comes
   * straight from the URL. Checking only the dist root while ALSO reading from src/ui would let a
   * traversal walk out of one root and land inside the other.
   */
  it('refuses to climb out of either root', () => {
    const root = makePlugin(['ui/bundle.js', 'src/ui/bundle.js', 'secret.txt']);
    for (const attempt of ['../secret.txt', '../../etc/passwd', 'chunks/../../secret.txt']) {
      expect(PluginArchiveSupport.resolveUiAsset(root, attempt)).toBeNull();
    }
  });

  it('refuses a traversal that would reach the sibling root', () => {
    const root = makePlugin(['src/ui/bundle.js']);
    // `ui/../src/ui/bundle.js` normalises out of `ui/` — it must not be accepted just because the
    // fallback root happens to contain the target.
    expect(PluginArchiveSupport.resolveUiAsset(root, '../src/ui/bundle.js')).toBeNull();
  });
});
