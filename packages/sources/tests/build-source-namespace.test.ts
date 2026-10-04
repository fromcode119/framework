import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BuildSourceMapper } from '@sources/sources/build-source-mapper';
import { ExtensionManifestReader } from '@sources/packaging/extension-manifest-reader';

/** The vendor travels from the repository's manifest to the Sources row, and "unknown" stays unknown. */
describe('a source\'s vendor', () => {
  const mapper = new BuildSourceMapper({ encrypt: (value: string) => value, decrypt: (value: string) => value });
  const row = (namespace: unknown) => mapper.normalizeSourceRecord({ slug: 'finestra', type: 'theme', git_url: 'https://github.com/a/b', namespace } as any);

  it('is passed through as built', () => {
    expect(row('org.fromcode').namespace).toBe('org.fromcode');
  });

  it('is empty when the built manifest declared none', () => {
    expect(row('').namespace).toBe('');
  });

  it('is absent when no build has recorded it yet', () => {
    expect(row(null).namespace).toBeUndefined();
  });

  it('is read from the repository\'s own manifest with the slug and kind', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-manifest-'));
    try {
      fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify({ slug: 'finestra', namespace: 'org.fromcode', version: '0.1.0' }));
      expect(ExtensionManifestReader.read(dir)).toMatchObject({ slug: 'finestra', type: 'theme', namespace: 'org.fromcode' });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
