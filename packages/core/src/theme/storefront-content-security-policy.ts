import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';
import { PluginNetworkDeclaration } from '@core/plugin/consent/plugin-network-declaration';

/**
 * What a storefront may load and where it may send data, for a site whose theme the SITE uploaded.
 *
 * A site's theme runs as the site's own front end, so its scripts cannot be sandboxed away from the
 * page; what can be limited is where they reach. Scripts, styles, images, fonts, frames and requests
 * may come from the site itself, the hosts the theme declares and the storefront hosts of the plugins
 * this site runs (plus any its operator allowed through a plugin's `storefrontHostsSetting`); forms post only to the site. A platform theme is curated and gets no policy here.
 *
 * Inline code stays allowed: the storefront itself inlines its runtime config and boot scripts, and a
 * theme's inline code is still bound by where it may connect. What no policy can stop is a script
 * sending the visitor to another address outright; that is a navigation, not a request.
 */
export class StorefrontContentSecurityPolicy {
  /**
   * @param plugins the site's active plugins as the storefront receives them (a site's own plugin
   *   carries only widgets, so no hosts)
   * @param extraOrigins origins the storefront itself uses besides its own, such as the api's public URL
   * @param pluginSettings the site's public plugin settings keyed by slug, read for a plugin's
   *   `storefrontHostsSetting` (the hosts this site's operator allows for it)
   */
  static of(
    theme: IThemeManifest | null,
    plugins: Array<{ slug?: string; ui?: { storefrontHosts?: unknown; storefrontHostsSetting?: unknown } }>,
    extraOrigins: string[] = [],
    pluginSettings: Record<string, Record<string, unknown> | undefined> = {},
  ): string | null {
    if (!theme?.ownerTenantId) return null;
    const hosts = new Set<string>();
    const add = (value: unknown) => {
      const host = String(value ?? '').trim().toLowerCase();
      if (PluginNetworkDeclaration.isHost(host)) hosts.add(host);
    };
    (Array.isArray(theme.network?.hosts) ? theme.network!.hosts : []).forEach(add);
    for (const plugin of plugins) {
      const declared = plugin.ui?.storefrontHosts;
      if (Array.isArray(declared)) declared.forEach(add);
      const setting = plugin.ui?.storefrontHostsSetting;
      const allowed = setting && plugin.slug ? pluginSettings[plugin.slug]?.[String(setting)] : undefined;
      if (Array.isArray(allowed)) allowed.forEach((entry) => add((entry as { host?: unknown } | null)?.host ?? entry));
    }
    const origins = extraOrigins.map((origin) => StorefrontContentSecurityPolicy.originOf(origin)).filter(Boolean);
    const sources = ["'self'", ...[...hosts].sort().map((host) => `https://${host}`), ...new Set(origins)].join(' ');
    return [
      "default-src 'self'",
      `script-src ${sources} 'unsafe-inline'`,
      `style-src ${sources} 'unsafe-inline'`,
      `img-src ${sources} data: blob:`,
      `font-src ${sources} data:`,
      `media-src ${sources} blob:`,
      `connect-src ${sources}`,
      `frame-src ${sources}`,
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }

  private static originOf(value: string): string {
    try {
      const url = new URL(String(value ?? ''));
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : '';
    } catch {
      return '';
    }
  }
}
