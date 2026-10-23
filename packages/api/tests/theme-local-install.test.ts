import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoreServices } from '@fromcode119/core';
import { ThemeMarketplaceInstall } from '@api/controllers/themes/theme-marketplace-install';
import { ThemeInstallSource } from '@api/controllers/themes/enums/theme-install-source.enum';

/**
 * A theme built by this installation is staged as an unpacked package directory. The Upgrade button
 * read that directory as a zip and failed with EISDIR, so no theme Sources built could be upgraded.
 */
describe('ThemeMarketplaceInstall — a package from this installation', () => {
  afterEach(() => vi.restoreAllMocks());

  const build = (artifact: string) => {
    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      catalogContributions: { resolveArtifact: async () => artifact },
    } as never);
    const manager = {
      getMarketplaceThemes: async () => [{ slug: 'aurora', version: '0.1.1', source: 'local' }],
      installFromDirectory: vi.fn(async () => ({})),
      installFromZip: vi.fn(async () => ({})),
      installTheme: vi.fn(),
    };
    const install = new ThemeMarketplaceInstall(manager as never, { info: vi.fn() } as never);
    return { manager, install };
  };

  it('installs a staged package directory as a directory', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-local-'));
    const { manager, install } = build(dir);

    await expect(install.install('aurora')).resolves.toBe(ThemeInstallSource.LOCAL);
    expect(manager.installFromDirectory).toHaveBeenCalledWith(dir);
    expect(manager.installFromZip).not.toHaveBeenCalled();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('installs a staged archive as a zip', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-local-'));
    const zip = path.join(dir, 'aurora-0.1.1.zip');
    fs.writeFileSync(zip, 'zip');
    const { manager, install } = build(zip);

    await expect(install.install('aurora')).resolves.toBe(ThemeInstallSource.LOCAL);
    expect(manager.installFromZip).toHaveBeenCalledWith(zip);
    expect(manager.installFromDirectory).not.toHaveBeenCalled();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
