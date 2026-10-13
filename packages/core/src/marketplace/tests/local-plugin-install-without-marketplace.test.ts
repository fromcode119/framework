import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoreServices } from '@core/services/core-services';
import { MarketplaceInstaller } from '@core/marketplace/marketplace-installer';

/**
 * An installation with no marketplace set can still update the plugins it built itself.
 *
 * The Update button asked for a marketplace before it looked at the offer, so on a platform with none
 * set (production) every locally built plugin answered "Marketplace is disabled." — the build sat on
 * disk, offered, and could not be installed from the console.
 */
describe('MarketplaceInstaller — installing without a marketplace', () => {
  afterEach(() => vi.restoreAllMocks());

  const build = (offer: Record<string, unknown>) => {
    const discovery = { installFromZip: vi.fn(async () => ({ slug: 'marketplace', version: '0.3.0' })), installFromDirectory: vi.fn() };
    const installer = new MarketplaceInstaller(
      { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
      discovery as never,
      new Map(),
      async () => ({ client: null, url: null }),
      async () => [offer] as never,
    );
    return { discovery, installer };
  };

  it('installs an offer from this installation from its package on disk', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-install-'));
    const zip = path.join(dir, 'marketplace-0.3.0.zip');
    fs.writeFileSync(zip, 'zip');
    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      catalogContributions: { resolveArtifact: async () => zip },
    } as never);
    const { discovery, installer } = build({ slug: 'marketplace', version: '0.3.0', source: 'local' });

    await expect(installer.downloadAndInstall('marketplace')).resolves.toMatchObject({ slug: 'marketplace', version: '0.3.0' });
    expect(discovery.installFromZip).toHaveBeenCalledWith(zip);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('still refuses a remote offer when no marketplace is set', async () => {
    const { installer } = build({ slug: 'shop', version: '1.0.0', source: 'remote', downloadUrl: 'download/shop' });

    await expect(installer.downloadAndInstall('shop')).rejects.toThrow('Marketplace is disabled.');
  });
});
