import { AppPathConstants } from '@fromcode119/core/client';
import { AdminRouteUtils } from '@/lib/admin-route-utils';
import type { IAppearanceSurfaces } from '@/lib/appearance/interfaces/appearance-surfaces.interface';
/**
 * Decides whether a given admin path is exposed by an appearance's surface allowlist.
 *
 * Containment semantics (NOT authorization — role/permission gates still run server-side):
 *   - `surfaces` ABSENT  → allow every path (legacy passthrough appearance, e.g. `simple`).
 *   - `surfaces` PRESENT → default-deny: a path is allowed only if it is the appearance landing (`/`),
 *     one of the always-reachable safety paths, under an allowed plugin's first segment, or under an
 *     allowed framework path prefix. Everything else is blocked while that appearance is active.
 */
export class AppearanceSurfacePolicy {
  /**
   * Framework-essential paths always reachable regardless of an appearance's allowlist, so a user can never
   * be locked out of switching appearance (the anti-lockout escape hatch).
   */
  private static readonly ALWAYS_ALLOWED: readonly string[] = [AppPathConstants.ADMIN.SETTINGS.APPEARANCE];

  static isPathAllowed(surfaces: IAppearanceSurfaces | undefined, path: string): boolean {
    if (!surfaces) return true;
    const p = AppearanceSurfacePolicy.normalize(path);
    if (p === '/') return true;
    // The unauthenticated auth routes are not a "surface" an appearance opts into — they are how a
    // visitor gets in at all. No allowlist mentioned them, so on a workspace domain `/login` counted as
    // outside the appearance and `AppearanceShellHost` passed `null` for the page: a blank sign-in with
    // nothing in the console to explain it. Containment is about which of the ADMIN's areas a skin
    // presents; it has no business deciding whether the login exists.
    if (AdminRouteUtils.isUnauthenticatedAuthRoute(p)) return true;
    if (AppearanceSurfacePolicy.ALWAYS_ALLOWED.some((a) => AppearanceSurfacePolicy.underPrefix(p, a))) return true;
    // A plugin's admin pages are NOT required to live under `/<slug>/…`. The hub plugin registers
    // `/hub-clients`, `/hub-projects`, … — so matching the first segment only for equality blocked
    // every page of a plugin the appearance had explicitly allowed, and the operator was told they
    // were "not part of the workspace" on a console built for exactly that plugin. A first segment
    // that IS the slug, or that begins `<slug>-`, belongs to it.
    const firstSegment = (p.split('/').filter(Boolean)[0] || '').toLowerCase();
    const plugins = surfaces.plugins || [];
    if (plugins.some((raw) => {
      const slug = String(raw).toLowerCase();
      return firstSegment === slug || firstSegment.startsWith(`${slug}-`);
    })) return true;
    const paths = surfaces.paths || [];
    if (paths.some((prefix) => AppearanceSurfacePolicy.underPrefix(p, prefix))) return true;
    return false;
  }

  /** Strips query/hash, ensures a leading slash, and drops a trailing slash (except for the root). */
  private static normalize(path: string): string {
    const q = String(path || '/').split('?')[0].split('#')[0];
    const withSlash = q.startsWith('/') ? q : `/${q}`;
    return withSlash.length > 1 && withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
  }

  /** True when `path` equals `prefix` or is a descendant of it (segment-boundary match, not substring). */
  private static underPrefix(path: string, prefix: string): boolean {
    const pre = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    return path === pre || path.startsWith(`${pre}/`);
  }
}
