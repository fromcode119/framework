import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { PluginArchiveInstallerService } from '@core/plugin/services/installation/plugin-archive-installer-service';
import { PluginDirectoryAction } from '@core/plugin/services/installation/enums/plugin-directory-action.enum';

/**
 * A mounted plugin directory that is a git checkout is SOURCE. An archive install replaced one with
 * packed output (TypeScript, tests and `.git` gone; restored from the framework's own backup). The
 * installer and the delete path now refuse before touching anything.
 */
describe('PluginArchiveInstallerService.refuseSourceCheckout', () => {
  it('refuses to replace or delete a directory that is a git checkout', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-src-'));
    fs.mkdirSync(path.join(dir, '.git'));
    expect(() => PluginArchiveInstallerService.refuseSourceCheckout(dir, 'eta', PluginDirectoryAction.REPLACE)).toThrow(/git checkout/);
    expect(() => PluginArchiveInstallerService.refuseSourceCheckout(dir, 'eta', PluginDirectoryAction.DELETE)).toThrow(/Refusing to delete plugin "eta"/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('never treats an empty path as the working directory', () => {
    expect(() => PluginArchiveInstallerService.refuseSourceCheckout('', 'eta', PluginDirectoryAction.DELETE)).not.toThrow();
  });

  it('lets an installed package (no .git) be replaced or deleted', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-pkg-'));
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{}');
    expect(() => PluginArchiveInstallerService.refuseSourceCheckout(dir, 'eta', PluginDirectoryAction.REPLACE)).not.toThrow();
    expect(() => PluginArchiveInstallerService.refuseSourceCheckout(path.join(dir, 'missing'), 'eta', PluginDirectoryAction.DELETE)).not.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
