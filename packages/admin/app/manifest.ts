import type { MetadataRoute } from 'next';
import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';

/**
 * PWA web app manifest (served by Next at /manifest.webmanifest) — makes the ADMIN app installable on a phone
 * home screen and run standalone. DOMAIN-AGNOSTIC and DEPLOYMENT-CONFIGURABLE: identity (name/icon/colors)
 * comes from the framework's own app config (`AppEnv.*`), never a plugin or appearance — and every value is
 * env-overridable so a platform rebrands the install experience WITHOUT patching framework source. The
 * framework's own brand mark + palette are the defaults, so an unconfigured deployment is unchanged.
 * `start_url: '/'` opens the
 * console root; the active appearance/role then routes the user to the right landing (a partner to their portal,
 * an admin to the dashboard) — the framework does not assume any plugin's routes exist. Full "Add to Home Screen"
 * install requires HTTPS in production; the manifest + responsive shell work over http too.
 */
export default function manifest(): MetadataRoute.Manifest {
  const name = String(AppEnv.APP_NAME || 'Admin');
  const icon = AdminPathUtils.toAdminPath(AppEnv.PWA_ICON_PATH);
  return {
    name,
    short_name: name,
    description: `${name} — manage your platform on the go.`,
    start_url: AdminPathUtils.toAdminPath('/'),
    scope: AdminPathUtils.toAdminPath('/'),
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
