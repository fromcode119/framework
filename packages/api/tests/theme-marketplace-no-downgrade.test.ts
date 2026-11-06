import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoreServices } from '@fromcode119/core';
import { ThemeMarketplaceInstall } from '@api/controllers/themes/theme-marketplace-install';
import { ThemeDowngradeRefusedError } from '@api/controllers/themes/theme-downgrade-refused-error';

/**
 * The marketplace card's Update button installs without naming a version. It took the catalogue's
 * FIRST row for the slug — an older build still listed there would have replaced an installed 1.2.35
 * with 1.2.6. It now takes the newest offer and refuses anything older than what is installed.
 */
describe('ThemeMarketplaceInstall — never a downgrade', () => {
  afterEach(() => vi.restoreAllMocks());

  const build = (installed: string | null, offers: string[]) => {
    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({ catalogContributions: { resolveArtifact: async () => null } } as never);
    const manager = {
      getMarketplaceThemes: async () => offers.map((version) => ({ slug: 'shop', version, downloadUrl: `shop-${version}.zip` })),
      getThemes: () => (installed ? [{ slug: 'shop', version: installed }] : []),
      installTheme: vi.fn(async () => undefined),
    };
    return { manager, install: new ThemeMarketplaceInstall(manager as never, { info: vi.fn() } as never) };
  };

  it('installs the newest offer when no version is named', async () => {
    const { manager, install } = build('1.2.35', ['1.2.6', '1.2.40']);
    await install.install('shop');
    expect(manager.installTheme).toHaveBeenCalledWith(expect.objectContaining({ version: '1.2.40' }));
  });

  it('refuses when the newest offer is older than what is installed', async () => {
    const { manager, install } = build('1.2.35', ['1.2.6']);
    await expect(install.install('shop')).rejects.toBeInstanceOf(ThemeDowngradeRefusedError);
    expect(manager.installTheme).not.toHaveBeenCalled();
  });

  it('refuses a named version older than what is installed', async () => {
    const { manager, install } = build('1.2.35', ['1.2.6', '1.2.35']);
    await expect(install.install('shop', '1.2.6')).rejects.toBeInstanceOf(ThemeDowngradeRefusedError);
    expect(manager.installTheme).not.toHaveBeenCalled();
  });

  it('installs any offer when the theme is not installed', async () => {
    const { manager, install } = build(null, ['1.2.6']);
    await install.install('shop');
    expect(manager.installTheme).toHaveBeenCalledWith(expect.objectContaining({ version: '1.2.6' }));
  });
});
