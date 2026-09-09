import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { PluginArchiveInstallerService } from '@core/plugin/services/installation/plugin-archive-installer-service';

/**
 * A mounted plugin directory that is a git checkout is SOURCE. An archive install replaced one with
 * packed output (TypeScript, tests and `.git` gone; restored from the framework's own backup). The
 * installer and the delete path now refuse before touching anything.
 */
describe('PluginArchiveInstallerService.refuseSourceCheckout', () => {
  it('refuses to replace or delete a directory that is a git checkout', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-src-'));
    fs.mkdirSync(path.join(dir, '.git'));
    expect(() => PluginArchiveInstallerService.refuseSourceCheckout(dir, 'eta', 'replace')).toThrow(/git checkout/);
    expect(() => PluginArchiveInstallerService.refuseSourceCheckout(dir, 'eta', 'delete')).toThrow(/Refusing to delete plugin "eta"/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('never treats an empty path as the working directory', () => {
    expect(() => PluginArchiveInstallerService.refuseSourceCheckout('', 'eta', 'delete')).not.toThrow();
  });

  it('lets an installed package (no .git) be replaced or deleted', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-pkg-'));
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{}');
    expect(() => PluginArchiveInstallerService.refuseSourceCheckout(dir, 'eta', 'replace')).not.toThrow();
    expect(() => PluginArchiveInstallerService.refuseSourceCheckout(path.join(dir, 'missing'), 'eta', 'delete')).not.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
