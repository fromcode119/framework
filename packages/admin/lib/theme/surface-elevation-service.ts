import { Platform } from '@fromcode119/reactor';
// core/client, NOT @fromcode119/sdk: the SDK root re-exports @fromcode119/database, which pulls `pg`
// into the client bundle and fails the admin build with "Client Component Browser" module errors.
import { CoercionUtils, SystemConstants } from '@fromcode119/core/client';

/**
 * Owns whether the admin renders with elevation (shadows) or flat.
 *
 * Every shadow in the admin resolves through `--fc-elevation-surface` / `--fc-elevation-control`
 * (see `admin.css`), so this only has to stamp one attribute on `<html>` — it never touches a
 * component. Flat mode keeps borders and radii and drops depth only.
 *
 * Like the appearance id, the `admin_shadows` system setting arrives async, so the last resolved
 * value is mirrored into localStorage and replayed synchronously on the next first paint. Without
 * that, a deployment configured flat would flash elevated on every navigation.
 */
export class SurfaceElevationService {
  private static readonly ATTRIBUTE = 'data-fc-shadows';
  private static readonly HINT_KEY = 'fc.admin.shadows';
  private static readonly OFF = 'off';
  private static readonly ON = 'on';

  /** Shadows are ON unless the setting explicitly says otherwise. */
  static isEnabled(globalSettings?: Record<string, unknown> | null): boolean {
    const settingsLoaded = !!globalSettings && Object.keys(globalSettings).length > 0;
    if (!settingsLoaded) return SurfaceElevationService.firstPaintHint();
    // Absent / unparseable = elevated; only an explicit false turns shadows off.
    return CoercionUtils.toBoolean((globalSettings as Record<string, unknown>)[SystemConstants.META_KEY.ADMIN_SHADOWS], true) !== false;
  }

  private static firstPaintHint(): boolean {
    if (!Platform.isBrowser) return true;
    try {
      return window.localStorage.getItem(SurfaceElevationService.HINT_KEY) !== SurfaceElevationService.OFF;
    } catch {
      return true;
    }
  }

  /** Stamp the resolved state onto <html> and remember it for the next first paint. */
  static apply(enabled: boolean): void {
    if (!Platform.isBrowser) return;
    const root = document.documentElement;
    if (enabled) root.removeAttribute(SurfaceElevationService.ATTRIBUTE);
    else root.setAttribute(SurfaceElevationService.ATTRIBUTE, SurfaceElevationService.OFF);
    try {
      window.localStorage.setItem(
        SurfaceElevationService.HINT_KEY,
        enabled ? SurfaceElevationService.ON : SurfaceElevationService.OFF,
      );
    } catch {
      /* localStorage unavailable — the next first paint falls back to elevated */
    }
  }

  /** Resolve from settings and apply in one step. */
  static sync(globalSettings?: Record<string, unknown> | null): void {
    SurfaceElevationService.apply(SurfaceElevationService.isEnabled(globalSettings));
  }
}
