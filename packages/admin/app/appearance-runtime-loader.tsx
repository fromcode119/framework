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
      if (AppearanceBundleLoaderService.needsLoad(desired)) {
        await AppearanceBundleLoaderService.ensureLoaded(desired);
      }
      if (active) setResolved(true);
    })();
    return () => { active = false; };
  }, []);

  if (!resolved) return <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" />;
  return <>{children}</>;
}
