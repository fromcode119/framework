import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { PluginStyleCompiler } from '@extension-builder/assets/plugin-style-compiler';
import { PluginStyleMarker } from '@extension-builder/assets/plugin-style-marker';

function scratch(withTailwind: boolean, withBundle = true) {
  const root = mkdtempSync(join(tmpdir(), 'plugin-style-'));
  const outDir = join(root, 'ui');
  mkdirSync(outDir, { recursive: true });
  if (withBundle) writeFileSync(join(outDir, 'bundle.js'), '// admin bundle');
  if (withTailwind) {
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(join(root, 'node_modules', '.bin', 'tailwindcss'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  }
  return { root, outDir };
}

describe('PluginStyleCompiler', () => {
  it('refuses to overwrite a hand-written style.css rather than destroying it', () => {
    const { root, outDir } = scratch(true);
    writeFileSync(join(outDir, 'style.css'), '.mine{color:red}');
    const result = PluginStyleCompiler.compile(join(root, 'src', 'ui'), outDir, 'demo', root);
    expect(result.failed).toBe(true);
    expect(result.message).toContain('hand-written');
    expect(readFileSync(join(outDir, 'style.css'), 'utf8')).toBe('.mine{color:red}');
  });

  it('accepts a sheet carrying the legacy build-plugins.sh marker as its own', () => {
    const { root, outDir } = scratch(true);
    writeFileSync(join(outDir, 'style.css'), `${PluginStyleMarker.LEGACY}\n.old{}`);
    const result = PluginStyleCompiler.compile(join(root, 'src', 'ui'), outDir, 'demo', root);
    expect(result.message).not.toContain('hand-written');
  });

  it('leaves no .building temp file behind when tailwind fails', () => {
    const { root, outDir } = scratch(true);
    PluginStyleCompiler.compile(join(root, 'src', 'ui'), outDir, 'demo', root);
    expect(existsSync(join(outDir, '.style.css.building'))).toBe(false);
  });

  it('skips a storefront-only plugin, and says so', () => {
    const { root, outDir } = scratch(true, false);
    const result = PluginStyleCompiler.compile(join(root, 'src', 'ui'), outDir, 'demo', root);
    expect(result.skippedReason).toContain('bundle.js');
  });

  it('says why it skipped when tailwind is not installed', () => {
    const { root, outDir } = scratch(false);
    const result = PluginStyleCompiler.compile(join(root, 'src', 'ui'), outDir, 'demo', root);
    expect(result.skippedReason).toContain('tailwindcss');
  });
});
