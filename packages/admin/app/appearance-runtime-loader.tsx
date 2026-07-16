"use client";

import React from 'react';
import { AppEnv } from '@/lib/env';
import { AppearanceBundleLoaderService } from '@/app/services/appearance-bundle-loader-service';
import { ActiveAdminAppearanceService } from '@/lib/appearance/active-admin-appearance-service';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { BrandTokenStyleService } from '@/lib/theme/brand-token-style-service';
import type { ClientLayoutChildrenProps } from './client-layout.interfaces';

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
export function AppearanceRuntimeLoader({ children }: ClientLayoutChildrenProps): React.ReactElement {
  const [resolved, setResolved] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const deploymentDefault = String(AppEnv.ADMIN_APPEARANCE || '').trim();
      let desired = ActiveAdminAppearanceService.firstPaintHint();
      try {
        const settings = await AdminSystemSettingsClient.getAll();
        desired = String((settings as Record<string, unknown>)?.admin_appearance || '').trim() || deploymentDefault;
      } catch {
        /* settings fetch failed — fall back to the first-paint hint */
      }
      try {
        BrandTokenStyleService.install((await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.FRONTEND) as Record<string, unknown>)?.cssVariables);
      } catch {
        /* The default token contract remains available when public theme metadata is unreachable. */
      }
      if (!active) return;
      ActiveAdminAppearanceService.rememberHint(desired);
      // Load the appearance bundle (with retry). If a NON-default appearance can't load, fail CLOSED — a
      // contained "workspace unavailable" screen — rather than falling through to the full default admin,
      // which would silently defeat the appearance's surface containment.
      let loaded = true;
      if (AppearanceBundleLoaderService.needsLoad(desired)) {
        loaded = await AppearanceBundleLoaderService.ensureLoaded(desired);
      }
      if (!active) return;
      setLoadFailed(desired !== 'default' && !loaded);
      setResolved(true);
    })();
    return () => { active = false; };
  }, []);

  if (!resolved) return <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" />;
  if (loadFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-[#020617]">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            The admin workspace couldn’t be loaded. This is usually temporary — reload to try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
