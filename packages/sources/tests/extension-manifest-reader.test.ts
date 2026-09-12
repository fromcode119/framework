import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExtensionManifestReader } from '@sources/packaging/extension-manifest-reader';

/**
 * What a repository says it IS. The Sources form does not ask — it reads this — so a kind this
 * cannot name is a kind nobody can add.
 */
describe('ExtensionManifestReader', () => {
  let dir: string;
  const write = (file: string, body: Record<string, unknown>) =>
    fs.writeFileSync(path.join(dir, file), JSON.stringify(body));

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-read-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('recognises an appearance', () => {
    // `appearance.json` was not in the list at all, so an appearance could only be added by calling
    // it something else — while the builder had been able to build one the whole time.
    write('appearance.json', { slug: 'aurora', name: 'Aurora', version: '1.0.0' });

    expect(ExtensionManifestReader.read(dir)).toMatchObject({ slug: 'aurora', type: 'appearance' });
  });

  it('prefers appearance.json over a manifest.json sitting beside it', () => {
    // The generic name was checked FIRST, so anything shipping one was read as a plugin.
    write('appearance.json', { slug: 'aurora', version: '1.0.0' });
    write('manifest.json', { slug: 'aurora', version: '1.0.0' });

    expect(ExtensionManifestReader.read(dir)?.type).toBe('appearance');
  });

  it('prefers theme.json over a manifest.json sitting beside it', () => {
    write('theme.json', { slug: 'fromcode', version: '0.1.29' });
    write('manifest.json', { slug: 'fromcode', version: '0.1.29' });

    expect(ExtensionManifestReader.read(dir)?.type).toBe('theme');
  });

  it('still reads a plain plugin', () => {
    write('manifest.json', { slug: 'forms', name: 'Forms', version: '0.1.31' });

    expect(ExtensionManifestReader.read(dir)).toMatchObject({ slug: 'forms', type: 'plugin' });
  });

  it('reads nothing from a repository that declares nothing, rather than guessing', () => {
    expect(ExtensionManifestReader.read(dir)).toBeNull();
  });
});
