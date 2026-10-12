import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarketplaceClient } from '@marketplace-client/marketplace-client';

/**
 * `plugin pack` left `dist/` out of the archive, but a plugin's compiled migrations live in
 * `dist/migrations` — its manifest names that folder and the installer refuses a package without it.
 */
describe('packing a plugin', () => {
  let root: string;
  const write = (file: string, body = 'x') => {
    fs.mkdirSync(path.dirname(path.join(root, 'shop', file)), { recursive: true });
    fs.writeFileSync(path.join(root, 'shop', file), body);
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-'));
    write('manifest.json', JSON.stringify({ slug: 'shop', version: '1.0.0', migrations: 'dist/migrations' }));
    write('index.js');
    write('dist/migrations/001-init.js');
    write('dist/shop-0.9.0.zip');
    write('node_modules/left-pad/index.js');
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('keeps dist/ (the migrations the manifest names) and leaves out dependencies and earlier archives', async () => {
    const zip = await new MarketplaceClient('http://marketplace.test').pack(path.join(root, 'shop'), path.join(root, 'out'));
    const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean);

    expect(entries).toContain('dist/migrations/001-init.js');
    expect(entries).toContain('manifest.json');
    expect(entries.some((entry) => entry.endsWith('.zip'))).toBe(false);
    expect(entries.some((entry) => entry.startsWith('node_modules/'))).toBe(false);
  });
});
