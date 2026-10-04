import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExtensionVendorGuard } from '@core/extensions/extension-vendor-guard';

describe('ExtensionVendorGuard', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-guard-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const installed = (file: string, manifest: Record<string, unknown>) => fs.writeFileSync(path.join(dir, file), JSON.stringify(manifest));

  it('refuses a theme from another vendor over an installed one', () => {
    installed('theme.json', { slug: 'finestra', namespace: 'org.fromcode' });
    expect(() => ExtensionVendorGuard.refuse(dir, 'theme.json', { slug: 'finestra', namespace: 'com.other' }, 'theme'))
      .toThrow(/theme "finestra" from "com\.other".*"org\.fromcode"/);
  });

  it('refuses an appearance that declares no vendor over one that does', () => {
    installed('appearance.json', { slug: 'hub', namespace: 'org.fromcode' });
    expect(() => ExtensionVendorGuard.refuse(dir, 'appearance.json', { slug: 'hub' }, 'appearance')).toThrow(/no vendor/);
  });

  it('lets the same vendor update', () => {
    installed('theme.json', { slug: 'finestra', namespace: 'org.fromcode' });
    expect(() => ExtensionVendorGuard.refuse(dir, 'theme.json', { slug: 'finestra', namespace: 'org.fromcode' }, 'theme')).not.toThrow();
  });

  it('lets anything replace an installed extension that declares no vendor, or a first install', () => {
    expect(() => ExtensionVendorGuard.refuse(dir, 'theme.json', { slug: 'new', namespace: 'com.other' }, 'theme')).not.toThrow();
    installed('theme.json', { slug: 'old' });
    expect(() => ExtensionVendorGuard.refuse(dir, 'theme.json', { slug: 'old', namespace: 'com.other' }, 'theme')).not.toThrow();
  });

  it('reads the kind\'s own manifest, not another kind\'s', () => {
    installed('manifest.json', { slug: 'x', namespace: 'org.fromcode' });
    expect(() => ExtensionVendorGuard.refuse(dir, 'theme.json', { slug: 'x', namespace: 'com.other' }, 'theme')).not.toThrow();
  });
});
