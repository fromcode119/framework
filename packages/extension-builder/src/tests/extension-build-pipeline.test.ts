import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ExtensionKind } from '@extension-builder/extension-kind';
import { ExtensionBuildPipeline } from '@extension-builder/extension-build-pipeline';

/** A plugin with a compilable backend and nothing else — most steps must SKIP, and say why. */
function minimalPlugin(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pipe-plugin-'));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ slug: 'demo', name: 'Demo' }, null, 2));
  writeFileSync(join(dir, 'index.ts'), 'export class DemoPlugin { static readonly slug = "demo"; }\n');
  mkdirSync(join(dir, 'node_modules'), { recursive: true });   // suppress the install step
  return dir;
}

function brokenPlugin(): string {
  const dir = minimalPlugin();
  writeFileSync(join(dir, 'index.ts'), 'export class Broken { oops( }\n');
  return dir;
}

describe('ExtensionBuildPipeline', () => {
  it('records a reason for every skipped step — silence is what hid the rename breakage', async () => {
    const results = await ExtensionBuildPipeline.run({
      sourceDir: minimalPlugin(), kind: ExtensionKind.PLUGIN, slug: 'demo', pack: false,
    });
    const skipped = results.filter((r) => r.skippedReason !== undefined);
    expect(skipped.length).toBeGreaterThan(0);
    for (const r of skipped) expect(r.skippedReason!.trim()).not.toBe('');
  });

  it('stops at the first failed step and names it', async () => {
    const results = await ExtensionBuildPipeline.run({
      sourceDir: brokenPlugin(), kind: ExtensionKind.PLUGIN, slug: 'demo', pack: false,
    });
    const last = results[results.length - 1]!;
    expect(last.failed).toBe(true);
    expect(last.step).toBe('plugin-backend-compiler');
  });

  it('skips clean, re-stamp and archive when pack is false', async () => {
    const results = await ExtensionBuildPipeline.run({
      sourceDir: minimalPlugin(), kind: ExtensionKind.PLUGIN, slug: 'demo', pack: false,
    });
    const steps = results.map((r) => r.step);
    expect(steps).not.toContain('pack-cleaner');
    expect(steps).not.toContain('archive-writer');
    expect(steps).toContain('integrity-stamper');   // the SOURCE stamp still happens
  });

  it('compiles the backend of a real plugin to index.js', async () => {
    const dir = minimalPlugin();
    const results = await ExtensionBuildPipeline.run({
      sourceDir: dir, kind: ExtensionKind.PLUGIN, slug: 'demo', pack: false,
    });
    expect(results.every((r) => !r.failed)).toBe(true);
    expect(existsSync(join(dir, 'index.js'))).toBe(true);
  });
});
