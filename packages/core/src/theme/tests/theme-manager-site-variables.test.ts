import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeManager } from '@core/theme/theme-manager';
import { TenantThemeAccess } from '@core/theme/tenant-theme-access';

/**
 * What a plugin reads as "the active theme's config and variables" must be the CURRENT site's: the
 * site's own saved row while a site is bound, the platform row only when none is. The plugin-facing
 * read used to go straight to the platform row, so a site's contact email or social links never
 * reached anything a plugin rendered for it — and another site's could.
 */
describe('ThemeManager — the active theme for the current site', () => {
  afterEach(() => vi.restoreAllMocks());

  const manifest = { slug: 'starter', variables: { contactEmail: 'declared@example.com', siteName: 'Declared' } };
  const platformRow = { variables: { contactEmail: 'platform@example.com' }, settings: { forms: { a: 1 } } };

  function manager(): any {
    const themes = Object.create(ThemeManager.prototype);
    themes.getActiveThemeManifest = () => manifest;
    themes.configService = { getThemeConfig: async (slug: string) => (slug === 'starter' ? platformRow : {}) };
    return themes;
  }

  it("a bound site reads its OWN saved variables over the theme's declared ones — never the platform row", async () => {
    vi.spyOn(TenantThemeAccess, 'currentChoice').mockReturnValue({ activeSlug: 'starter', config: { variables: { contactEmail: 'site@example.com' } } } as any);
    const themes = manager();
    await expect(themes.getActiveThemeVariables()).resolves.toEqual({ contactEmail: 'site@example.com', siteName: 'Declared' });
    await expect(themes.getActiveThemeConfig()).resolves.toEqual({ variables: { contactEmail: 'site@example.com' } });
  });

  it('with no site (single-site install) the platform row is the saved config', async () => {
    vi.spyOn(TenantThemeAccess, 'currentChoice').mockReturnValue(null);
    const themes = manager();
    await expect(themes.getActiveThemeVariables()).resolves.toEqual({ contactEmail: 'platform@example.com', siteName: 'Declared' });
    await expect(themes.getActiveThemeConfig()).resolves.toEqual(platformRow);
  });

  it('no active theme: nothing, not a made-up theme', async () => {
    const themes = manager();
    themes.getActiveThemeManifest = () => null;
    await expect(themes.getActiveThemeVariables()).resolves.toEqual({});
    await expect(themes.getActiveThemeConfig()).resolves.toEqual({});
  });
});
