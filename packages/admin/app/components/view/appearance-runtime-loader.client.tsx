import type { ReactElement, ReactNode } from 'react';
import { Platform, Reactor, prop, state, bound } from '@fromcode119/reactor';
import { AppEnv } from '@/lib/env';
import { AppearanceBundleLoaderService } from '@/app/services/appearance-bundle-loader-service';
import { ActiveAdminAppearanceService } from '@/lib/appearance/active-admin-appearance-service';
import { SurfaceElevationService } from '@/lib/theme/surface-elevation-service';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminRouteUtils } from '@/lib/admin-route-utils';
import { BrandTokenStyleService } from '@/lib/theme/brand-token-style-service';
import { AdminClass } from '@/lib/admin-class';
import { HostInfoClient } from '@/lib/tenants/host-info-client';
import { TenantOption } from '@/lib/tenants/tenant-option';
import { WorkspaceAppearanceLock } from '@/lib/appearance/workspace-appearance-lock';
import { SessionAppearanceChoice } from '@/lib/appearance/session-appearance-choice';

/**
 * Loads the active external appearance's runtime bundle BEFORE rendering the admin tree, so the
 * appearance is registered by the time AdminRuntimeProvider resolves activeAppearanceId.
 *
 * The AUTHORITATIVE source is the live `admin_appearance` system setting fetched here — the admin's
 * React `globalSettings`/SettingsContext is empty in this app, so it can't drive the shell. The
 * localStorage hint is only a first-paint bridge to avoid flashing the default while that fetch is in
 * flight; the fetched setting then reconciles the hint (fixing any stale value).
 *
 * `resolved` starts false on the SERVER and the FIRST client render alike, so SSR and hydration emit
 * the SAME neutral placeholder (otherwise the server-rendered subtree orphans as a stray full-height
 * div — the "whitespace below everything"). The gate is decided post-hydration in the effect.
 */
export class AppearanceRuntimeLoader extends Reactor {
  @prop declare children: ReactNode;
  @state private resolved = false;
  @state private loadFailed = false;
  private active = false;

  componentDidMount(): void {
    this.active = true;
    void this.resolveAppearance();
  }

  componentWillUnmount(): void {
    this.active = false;
  }

  @bound private reload(): void {
    window.location.reload();
  }

  private async resolveAppearance(): Promise<void> {

      // The auth routes (login / forgot / reset) on the SHARED admin host are appearance-agnostic:
      // `admin_appearance` comes from the auth-guarded `/system/admin/settings` (a 401 the browser logs
      // on the login screen), so there is nothing to resolve before anyone signs in. A WORKSPACE domain
      // is different — see the `isAuthRoute` early return below.
      const isAuthRoute = AdminRouteUtils.isUnauthenticatedAuthRoute(
        !Platform.isBrowser ? '' : (window.location.pathname || ''),
      );

      const deploymentDefault = String(AppEnv.ADMIN_APPEARANCE || '').trim();
      let desired = ActiveAdminAppearanceService.firstPaintHint();
      // Elevation is stamped from the first-paint hint straight away so the login screen (which never
      // fetches settings) still honours a flat deployment instead of flashing shadows.
      SurfaceElevationService.sync(null);
      // T6: a WORKSPACE domain is locked to its tenant's appearance — the kind decides, no setting
      // exists. Asked first and publicly, so the login on that domain already knows whose it is.
      const workspace = await HostInfoClient.workspace();
      if (workspace) {
        desired = workspace.appearance || 'default';
        WorkspaceAppearanceLock.lock(workspace.appearance, workspace.slug);
      } else {
        WorkspaceAppearanceLock.clear();
      }
      if (!isAuthRoute && !workspace) {
        try {
          const settings = await AdminSystemSettingsClient.getAll();
          desired = String((settings as Record<string, unknown>)?.admin_appearance || '').trim() || deploymentDefault;
          SurfaceElevationService.sync(settings as Record<string, unknown>);
        } catch {
          /* settings fetch failed — fall back to the first-paint hint */
        }
        // On the shared admin host a PLATFORM admin opens a workspace tenant either as its
        // appearance or in the default console to configure it — a per-session choice made in the
        // site switcher and carried by the session, never by a setting.
        desired = await AppearanceRuntimeLoader.workspaceSessionChoice(desired);
      }
      try {
        BrandTokenStyleService.install((await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.FRONTEND) as Record<string, unknown>)?.cssVariables);
      } catch {
        /* The default token contract remains available when public theme metadata is unreachable. */
      }
      if (!this.active) return;
      // A WORKSPACE domain is the exception: its appearance comes from the PUBLIC `/auth/host` route,
      // and the bundle + stylesheet the admin serves for it need no session either — so its login can
      // wear the workspace's own appearance, which is much of the point of giving it its own domain.
      // (This blanked the login once: the surface allowlist mentioned no auth route, so
      // `AppearanceShellHost` passed `null` for the page. `AppearanceSurfacePolicy` now always allows
      // them.) The skip below stays for the SHARED admin host, where the appearance comes from the
      // auth-gated settings endpoint and there is nothing to resolve before anyone signs in.
      if (isAuthRoute && !workspace) {
        this.resolved = true;
        return;
      }
      ActiveAdminAppearanceService.rememberHint(desired);
      // Load the appearance bundle (with retry). If a NON-default appearance can't load, fail CLOSED — a
      // contained "workspace unavailable" screen — rather than falling through to the full default admin,
      // which would silently defeat the appearance's surface containment.
      //
      // `.catch` is load-bearing, not defensive: `ensureLoaded` awaits `GlobalReadinessService.waitForReady()`
      // OUTSIDE its own try, and that REJECTS after ~5s. An unhandled rejection here leaves `resolved`
      // false for the life of the page — the shell then renders its neutral placeholder forever, which
      // is an empty full-height div, i.e. a white screen with nothing in the console to explain it.
      let loaded = true;
      if (AppearanceBundleLoaderService.needsLoad(desired)) {
        loaded = await AppearanceBundleLoaderService.ensureLoaded(desired).catch(() => false);
      }
      if (!this.active) return;
      // The LOGIN must render whatever happened to the appearance. Failing closed here would put a
      // "workspace unavailable" screen in front of the one page that can fix a broken session, and an
      // unstyled sign-in still signs you in.
      this.loadFailed = !isAuthRoute && desired !== 'default' && !loaded;
      this.resolved = true;
  }

  private static async workspaceSessionChoice(fallback: string): Promise<string> {
    const available = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE).catch(() => null);
    if (!available || available.multiTenant !== true) { SessionAppearanceChoice.clear(); return fallback; }
    const current = TenantOption.fromList(available.tenants).find((tenant) => tenant.id === available.current);
    if (!current || !current.isWorkspace) { SessionAppearanceChoice.clear(); return fallback; }
    const chosen = String(available.mode || '') === 'appearance' ? (current.appearance || 'default') : 'default';
    SessionAppearanceChoice.set(chosen);
    return chosen;
  }

  render(): ReactElement {
    if (!this.resolved) return <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" />;
    if (this.loadFailed) {
      return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-[#020617]">
        <div className={`w-full max-w-md ${AdminClass.SURFACE} p-8 text-center`}>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            The admin workspace couldn’t be loaded. This is usually temporary — reload to try again.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Reload
          </button>
        </div>
      </div>
      );
    }
    return <>{this.children}</>;
  }
}
