import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExtensionDirectorySwap } from '@core/extensions/extension-directory-swap';

/**
 * A plugin update must never leave its directory visible half-written: a second api booting during a
 * rolling deploy read a mixed old/new plugin, failed its integrity check and kept it in error.
 */
describe('ExtensionDirectorySwap', () => {
  let root: string;
  const target = () => path.join(root, 'shop');
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-swap-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('keeps the complete old directory in place until the new one is complete', async () => {
    fs.mkdirSync(target());
    fs.writeFileSync(path.join(target(), 'manifest.json'), 'old');
    fs.writeFileSync(path.join(target(), 'index.js'), 'old');
    await ExtensionDirectorySwap.replace(target(), async (staging) => {
      fs.writeFileSync(path.join(staging, 'manifest.json'), 'new');
      // Mid-update, the live directory is still the old one, whole.
      expect(fs.readFileSync(path.join(target(), 'manifest.json'), 'utf8')).toBe('old');
      expect(fs.readFileSync(path.join(target(), 'index.js'), 'utf8')).toBe('old');
      fs.writeFileSync(path.join(staging, 'index.js'), 'new');
    });
    expect(fs.readFileSync(path.join(target(), 'manifest.json'), 'utf8')).toBe('new');
    expect(fs.readFileSync(path.join(target(), 'index.js'), 'utf8')).toBe('new');
    expect(fs.readdirSync(root)).toEqual(['shop']);
  });

  it('leaves the installed plugin untouched when building the new one fails', async () => {
    fs.mkdirSync(target());
    fs.writeFileSync(path.join(target(), 'manifest.json'), 'old');
    await expect(ExtensionDirectorySwap.replace(target(), async () => { throw new Error('npm failed'); })).rejects.toThrow('npm failed');
    expect(fs.readFileSync(path.join(target(), 'manifest.json'), 'utf8')).toBe('old');
    expect(fs.readdirSync(root)).toEqual(['shop']);
  });

  it('installs a plugin that was not there before', async () => {
    await ExtensionDirectorySwap.replace(target(), async (staging) => { fs.writeFileSync(path.join(staging, 'manifest.json'), 'new'); });
    expect(fs.readFileSync(path.join(target(), 'manifest.json'), 'utf8')).toBe('new');
  });

  it('swaps synchronously for installers that fill the directory in one go', () => {
    fs.mkdirSync(target());
    fs.writeFileSync(path.join(target(), 'theme.json'), 'old');
    ExtensionDirectorySwap.replaceSync(target(), (staging) => {
      fs.writeFileSync(path.join(staging, 'theme.json'), 'new');
      expect(fs.readFileSync(path.join(target(), 'theme.json'), 'utf8')).toBe('old');
    });
    expect(fs.readFileSync(path.join(target(), 'theme.json'), 'utf8')).toBe('new');
    expect(fs.readdirSync(root)).toEqual(['shop']);
    expect(() => ExtensionDirectorySwap.replaceSync(target(), () => { throw new Error('bad package'); })).toThrow('bad package');
    expect(fs.readFileSync(path.join(target(), 'theme.json'), 'utf8')).toBe('new');
    expect(fs.readdirSync(root)).toEqual(['shop']);
  });
});
