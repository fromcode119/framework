import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';
import { TenantThemeAccess } from '@core/theme/tenant-theme-access';

/**
 * The active theme's saved config and variables for the CURRENT request's site: the site's own row when
 * a site is bound, the platform row otherwise. Never both — one site's settings must not leak into
 * another. The storefront, plugins and the framework's own emails all read it this way.
 */
export class ThemeActiveSiteConfig {
  static async config(
    manifest: IThemeManifest | null,
    platformRows: { getThemeConfig(slug: string): Promise<any> },
  ): Promise<Record<string, any>> {
    if (!manifest) return {};
    const override = ThemeActiveSiteConfig.siteOverride(manifest);
    return override !== undefined ? override : await platformRows.getThemeConfig(manifest.slug);
  }

  /** The theme's declared variables with the site's saved changes over them. */
  static async variables(
    manifest: IThemeManifest | null,
    platformRows: { getThemeConfig(slug: string): Promise<any> },
  ): Promise<Record<string, unknown>> {
    if (!manifest) return {};
    const config = await ThemeActiveSiteConfig.config(manifest, platformRows);
    return { ...(manifest.variables || {}), ...(config?.variables || {}) };
  }

  /** The TENANT's saved config, when there is a tenant using this theme; undefined means the platform row. */
  static siteOverride(manifest: IThemeManifest | null): Record<string, any> | undefined {
    const choice = TenantThemeAccess.currentChoice();
    return choice && manifest && choice.activeSlug === manifest.slug ? (choice.config || {}) : undefined;
  }
}
