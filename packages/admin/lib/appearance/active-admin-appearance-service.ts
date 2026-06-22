import { ClientRuntimeConstants } from '@fromcode119/core/client';
import { AppEnv } from '@/lib/env';
import { AdminAppearanceRegistry } from './admin-appearance-registry';
import { AdminAppearanceResolver } from './admin-appearance-resolver';

/**
 * Resolves the active admin appearance id from runtime inputs: the per-tenant override (system setting
 * `admin_appearance`) and the per-deployment default (AppEnv.ADMIN_APPEARANCE), validated against the
 * shared registry. Returns the built-in default when nothing else applies.
 *
 * Also owns the SYNCHRONOUS first-paint hint (localStorage): the `admin_appearance` setting arrives
 * async, so on the first render `globalSettings` is empty and we'd otherwise resolve to the default
 * appearance and flash it before the real one loads. The hint — kept in sync with the resolved id on
 * every render — lets both the runtime loader and the provider pick the RIGHT appearance from frame one.
 */
export class ActiveAdminAppearanceService {
  private static readonly HINT_KEY = ClientRuntimeConstants.ADMIN_UI.STORAGE_KEYS.ADMIN_APPEARANCE;

  static firstPaintHint(): string {
    const deploymentDefault = String(AppEnv.ADMIN_APPEARANCE || '').trim();
    if (typeof window === 'undefined') return deploymentDefault;
    try {
      return (window.localStorage.getItem(ActiveAdminAppearanceService.HINT_KEY) || '').trim() || deploymentDefault;
    } catch {
      return deploymentDefault;
    }
  }

  /** Keep the first-paint hint in sync with the resolved active appearance id. */
  static rememberHint(id: string): void {
    if (typeof window === 'undefined') return;
    const desired = (id || '').trim();
    try {
      if (!desired || desired === 'default') {
        window.localStorage.removeItem(ActiveAdminAppearanceService.HINT_KEY);
      } else {
        window.localStorage.setItem(ActiveAdminAppearanceService.HINT_KEY, desired);
      }
    } catch {
      /* localStorage unavailable — first paint falls back to the deployment default */
    }
  }

  /**
   * The RAW desired appearance id (NOT validated against the registry) — what the runtime loader must
   * ensure is loaded. Uses the live setting once settings have loaded, else the first-paint hint.
   */
  static desiredFrom(globalSettings?: Record<string, unknown> | null): string {
    const settingsLoaded = !!globalSettings && Object.keys(globalSettings).length > 0;
    if (!settingsLoaded) return ActiveAdminAppearanceService.firstPaintHint();
    const deploymentDefault = String(AppEnv.ADMIN_APPEARANCE || '').trim();
    return String((globalSettings as Record<string, unknown>).admin_appearance || '').trim() || deploymentDefault;
  }

  /** The VALIDATED active id — only returns a registered appearance, falling back to the built-in default. */
  static select(globalSettings?: Record<string, unknown> | null): string {
    return AdminAppearanceResolver.resolveAppearanceId({
      tenantAppearanceId: ActiveAdminAppearanceService.desiredFrom(globalSettings),
      deploymentAppearanceId: AppEnv.ADMIN_APPEARANCE,
      registeredIds: AdminAppearanceRegistry.shared.ids(),
    });
  }
}
