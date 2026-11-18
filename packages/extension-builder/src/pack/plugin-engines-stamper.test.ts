import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PluginEnginesStamper } from '@extension-builder/pack/plugin-engines-stamper';

describe('PluginEnginesStamper', () => {
  const made: string[] = [];
  afterEach(() => { for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

  function packDirWith(manifest: unknown): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engines-'));
    made.push(dir);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return dir;
  }
  const readEngines = (dir: string) => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).engines;

  it('rangeFor builds a >= floor and rejects what is not a version', () => {
    expect(PluginEnginesStamper.rangeFor('0.2.606')).toBe('>=0.2.606');
    expect(PluginEnginesStamper.rangeFor('v0.2.606')).toBe('>=0.2.606');
    expect(PluginEnginesStamper.rangeFor('')).toBeNull();
    expect(PluginEnginesStamper.rangeFor('latest')).toBeNull();
  });

  it('stamps engines.core into a packed manifest that declares none', () => {
    const dir = packDirWith({ slug: 'x', version: '1.0.0' });
    expect(PluginEnginesStamper.stamp(dir, '0.2.606')).toMatchObject({ stamped: true, range: '>=0.2.606' });
    expect(readEngines(dir)).toEqual({ core: '>=0.2.606' });
  });

  it('leaves a hand-declared floor untouched (a raised floor is deliberate)', () => {
    const dir = packDirWith({ slug: 'x', version: '1.0.0', engines: { core: '>=0.3.0' } });
    expect(PluginEnginesStamper.stamp(dir, '0.2.606').stamped).toBe(false);
    expect(readEngines(dir).core).toBe('>=0.3.0');
  });

  it('fails open when the core version is unknown — nothing is stamped', () => {
    const dir = packDirWith({ slug: 'x', version: '1.0.0' });
    expect(PluginEnginesStamper.stamp(dir, null).stamped).toBe(false);
    expect(readEngines(dir)).toBeUndefined();
  });

  it('does nothing when there is no manifest', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engines-'));
    made.push(dir);
    expect(PluginEnginesStamper.stamp(dir, '0.2.606')).toMatchObject({ stamped: false });
  });

  it('resolveCoreVersion returns the framework ROOT version (real semver, never the 0.0.0 placeholder)', () => {
    const v = PluginEnginesStamper.resolveCoreVersion();
    expect(v).toBeTruthy();
    expect(/^\d+\.\d+\.\d+/.test(String(v))).toBe(true);
    expect(String(v).startsWith('0.0.0')).toBe(false);
  });
});
