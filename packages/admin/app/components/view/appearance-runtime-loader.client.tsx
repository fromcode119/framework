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

      // The unauthenticated auth routes (login / forgot / reset) are appearance-AGNOSTIC. Loading the
      // workspace appearance bundle there is both unnecessary and harmful: `admin_appearance` comes from the
      // auth-guarded `/system/admin/settings` (a 401 the browser logs on the login screen), and the bundle
      // load waits on `GlobalReadinessService.waitForReady()` + a guarded bundle URL that never resolves for
      // a logged-out visitor → `resolved` never flips → a BLANK login. Render the (public-token-styled) auth
      // route immediately and defer the appearance to the authenticated workspace.
      const isAuthRoute = AdminRouteUtils.isUnauthenticatedAuthRoute(
        !Platform.isBrowser ? '' : (window.location.pathname || ''),
      );

      const deploymentDefault = String(AppEnv.ADMIN_APPEARANCE || '').trim();
      let desired = ActiveAdminAppearanceService.firstPaintHint();
      // Elevation is stamped from the first-paint hint straight away so the login screen (which never
      // fetches settings) still honours a flat deployment instead of flashing shadows.
      SurfaceElevationService.sync(null);
      if (!isAuthRoute) {
        try {
          const settings = await AdminSystemSettingsClient.getAll();
          desired = String((settings as Record<string, unknown>)?.admin_appearance || '').trim() || deploymentDefault;
          SurfaceElevationService.sync(settings as Record<string, unknown>);
        } catch {
          /* settings fetch failed — fall back to the first-paint hint */
        }
      }
      try {
        BrandTokenStyleService.install((await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.FRONTEND) as Record<string, unknown>)?.cssVariables);
      } catch {
        /* The default token contract remains available when public theme metadata is unreachable. */
      }
      if (!this.active) return;
      if (isAuthRoute) {
        // Skip the (hang-prone, auth-gated) appearance bundle load on the login screen — render it now.
        this.resolved = true;
        return;
      }
      ActiveAdminAppearanceService.rememberHint(desired);
      // Load the appearance bundle (with retry). If a NON-default appearance can't load, fail CLOSED — a
      // contained "workspace unavailable" screen — rather than falling through to the full default admin,
      // which would silently defeat the appearance's surface containment.
      let loaded = true;
      if (AppearanceBundleLoaderService.needsLoad(desired)) {
        loaded = await AppearanceBundleLoaderService.ensureLoaded(desired);
      }
      if (!this.active) return;
      this.loadFailed = desired !== 'default' && !loaded;
      this.resolved = true;
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
