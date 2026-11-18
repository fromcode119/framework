import { Platform } from '@fromcode119/react-class-components';
// core/client, NOT @fromcode119/sdk: the SDK root re-exports @fromcode119/database, which pulls `pg`
// into the client bundle and fails the admin build with "Client Component Browser" module errors.
import { CoercionUtils, SystemConstants } from '@fromcode119/core/client';

/**
 * Owns whether a section's pages stand in a SECOND column beside the menu, or under their own line
 * inside the one menu.
 *
 * One menu is the console's shape. The second column is kept as a setting because it was the shape
 * before, and an operator who prefers it can have it back without a release.
 *
 * It is a width decision, not a taste one. Measured on a 1280px window, product record, 18.11.2026:
 * the menu takes 240px and the second column another 220, so the record is left 767px — and a record
 * page only puts its side column beside the form from 896px up. The column therefore never fitted at
 * 1280, and all 21 of the product's cards fell into one stack 5 034px tall. Without the second
 * column the record gets 987px, the two columns open (531 + 440) and the same page is 2 745px.
 *
 * Every rule hangs off ONE attribute on `<html>` (see `admin.css`), so no component is edited and
 * the switch takes effect without a reload.
 *
 * Like the appearance id and the shadow switch, the setting arrives async, so the last resolved value
 * is mirrored into localStorage and replayed synchronously on the next first paint — otherwise a
 * console configured with the column would flash without it on every navigation.
 */
export class NavLayoutService {
  private static readonly ATTRIBUTE = 'data-fc-nav-column';
  private static readonly HINT_KEY = 'fc.admin.navColumn';
  private static readonly ON = 'on';
  private static readonly OFF = 'off';

  /** The second column is OFF unless the setting explicitly asks for it. */
  static isColumnEnabled(globalSettings?: Record<string, unknown> | null): boolean {
    const settingsLoaded = !!globalSettings && Object.keys(globalSettings).length > 0;
    if (!settingsLoaded) return NavLayoutService.firstPaintHint();
    // Absent / unparseable = one menu; only an explicit true draws the column.
    return CoercionUtils.toBoolean((globalSettings as Record<string, unknown>)[SystemConstants.META_KEY.ADMIN_NAV_COLUMN], false) === true;
  }

  private static firstPaintHint(): boolean {
    if (!Platform.isBrowser) return false;
    try {
      return window.localStorage.getItem(NavLayoutService.HINT_KEY) === NavLayoutService.ON;
    } catch {
      return false;
    }
  }

  /** Stamp the resolved state onto <html> and remember it for the next first paint. */
  static apply(columnEnabled: boolean): void {
    if (!Platform.isBrowser) return;
    const root = document.documentElement;
    if (columnEnabled) root.setAttribute(NavLayoutService.ATTRIBUTE, NavLayoutService.ON);
    else root.removeAttribute(NavLayoutService.ATTRIBUTE);
    try {
      window.localStorage.setItem(
        NavLayoutService.HINT_KEY,
        columnEnabled ? NavLayoutService.ON : NavLayoutService.OFF,
      );
    } catch {
      /* localStorage unavailable — the next first paint falls back to one menu */
    }
  }

  /** Resolve from settings and apply in one step. */
  static sync(globalSettings?: Record<string, unknown> | null): void {
    NavLayoutService.apply(NavLayoutService.isColumnEnabled(globalSettings));
  }
}
