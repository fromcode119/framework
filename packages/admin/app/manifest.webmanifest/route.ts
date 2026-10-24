import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { ConsoleMountConstants } from '@fromcode119/core/constants/console-mount.constants';
import { ConsoleMountUtils } from '@fromcode119/core/utils/console-mount-utils';
import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';
import { AdminConsoleBrand } from '@/lib/admin-console-brand';

/**
 * PWA web app manifest (served at /manifest.webmanifest) — makes the ADMIN app installable on a phone
 * home screen and run standalone. DOMAIN-AGNOSTIC and DEPLOYMENT-CONFIGURABLE: identity (name/icon/colors)
 * comes from the framework's own app config (`AppEnv.*`), never a plugin — and every value is
 * env-overridable so a platform rebrands the install experience WITHOUT patching framework source. The
 * framework's own brand mark + palette are the defaults, so an unconfigured deployment is unchanged.
 * `start_url: '/'` opens the
 * console root; the active appearance/role then routes the user to the right landing (a partner to their portal,
 * an admin to the dashboard) — the framework does not assume any plugin's routes exist. Full "Add to Home Screen"
 * install requires HTTPS in production; the manifest + responsive shell work over http too.
 * On a console mounted at a site's console path every address carries the mount the gateway names, so
 * the installed app opens — and stays scoped to — that path.
 *
 * A route handler rather than Next's `manifest.ts` metadata convention: that one also injects its own
 * `<link rel="manifest">` at the root path, beside the mounted link the layout writes, so a console at a
 * site's path fetched a manifest from the storefront and logged a 404 on every page.
 *
 * A site that wears an appearance installs under that appearance's name and icon (`AdminConsoleBrand`).
 */
export class AdminWebManifestRoute {
  /** Per request: the addresses depend on the mount the gateway names. */
  static readonly dynamic = 'force-dynamic';

  static async GET(): Promise<NextResponse> {
    return NextResponse.json(await AdminWebManifestRoute.document(), {
      headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  /** Build the manifest document from the framework's own app config. */
  private static async document(): Promise<MetadataRoute.Manifest> {
    const requestHeaders = await headers();
    const mount = ConsoleMountUtils.sanitize(requestHeaders.get(ConsoleMountConstants.HEADER));
    const brand = await AdminConsoleBrand.forHost(requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '');
    const name = brand?.name || String(AppEnv.APP_NAME || 'Admin');
    const icon = brand?.icon ? ConsoleMountUtils.prefix(brand.icon, mount) : AdminPathUtils.toBrowserPath(AppEnv.PWA_ICON_PATH, mount);
    return {
      name,
      short_name: name,
      description: `${name} — manage your platform on the go.`,
      start_url: AdminPathUtils.toBrowserPath('/', mount),
      scope: AdminPathUtils.toBrowserPath('/', mount),
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: AppEnv.PWA_BACKGROUND_COLOR,
      theme_color: AppEnv.PWA_THEME_COLOR,
      icons: [
        { src: icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: icon, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    };
  }
}
