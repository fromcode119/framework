import { CoercionUtils } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * Which settings on a screen belong to the PLATFORM rather than to the site being administered.
 *
 * The list is the SERVER's — `TenantBespokePolicies.platformKeys()`, the same definition the row-level
 * policy and the tenant importer read — so the admin never keeps a second copy to drift from.
 *
 * It answers two different questions, and they are not the same question:
 *
 * - {@link shown} — does this setting BELONG on the screen in the current scope? Scope is the screen.
 * - {@link writable} — could this scope persist it if it were shown? The API is the authority; this
 *   mirrors it so the form never offers a control that fails when pressed.
 *
 * A save requires BOTH, because they genuinely differ: a platform admin inside a site may write a
 * platform key, but that control lives in the platform scope.
 *
 * On a single-tenant deployment there is no second scope, so nothing is hidden and nothing is locked.
 */
export class PlatformSettingLocks {
  private constructor(
    private readonly keys: Set<string>,
    private readonly inherited: Set<string>,
    private readonly editable: boolean,
    private readonly tenantMode: boolean,
    private readonly siteSelected: boolean,
    private readonly defaults: Record<string, string> = {},
  ) {}

  /** Nothing locked — the state before the answer arrives, and after a failed request. */
  static none(): PlatformSettingLocks {
    return new PlatformSettingLocks(new Set(), new Set(), true, false, true);
  }

  static async load(): Promise<PlatformSettingLocks> {
    // try/catch, not `.catch()`: the latter covers a rejected request but NOT a synchronous throw
    // from the call itself (a missing base URL, a bad endpoint constant), which would escape `load`
    // and leave the page with no locks object at all.
    let response: any = null;
    try {
      response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS_PLATFORM_KEYS);
    } catch {
      return PlatformSettingLocks.none();
    }
    if (!response) return PlatformSettingLocks.none();
    const keys: string[] = Array.isArray(response.keys) ? response.keys.map((key: unknown) => String(key)) : [];
    const inherited: string[] = Array.isArray(response.inheritedKeys)
      ? response.inheritedKeys.map((key: unknown) => String(key))
      : [];
    return new PlatformSettingLocks(
      new Set(keys),
      new Set(inherited),
      response.editable !== false,
      response.tenantMode === true,
      response.siteSelected !== false,
      CoercionUtils.toObject(response.declaredDefaults) as Record<string, string>,
    );
  }

  /** What the server sends for this setting when the scope has no value of its own; '' when nothing. */
  declaredDefault(key: string): string {
    return String(this.defaults[key] ?? '');
  }

  /**
   * A platform setting this account may not change.
   *
   * An INHERITED key is exempt: what a site writes is its OWN row, so there is no platform value being
   * changed and no platform admin needed to change it.
   */
  private locksAsPlatformOnly(key: string): boolean {
    if (this.isInherited(key) && this.isSiteScope()) return false;
    return !this.editable && this.keys.has(key);
  }

  /** May every site override this key with its own value? */
  private isInherited(key: string): boolean {
    return this.inherited.has(key);
  }

  /** A per-site setting with no site selected — there is no row it could belong to. */
  private locksAsSiteless(key: string): boolean {
    return this.tenantMode && !this.siteSelected && !this.keys.has(key);
  }

  /** Is this setting out of reach in the current scope, for either reason? */
  locks(key: string): boolean {
    return this.locksAsPlatformOnly(key) || this.locksAsSiteless(key);
  }

  /** May this scope actually persist this key? */
  writable(key: string): boolean {
    return !this.locks(key);
  }

  /**
   * Does this setting BELONG on the screen in the current scope?
   *
   * Scope is the screen: the platform scope shows the platform's settings, a site shows its own. This
   * replaced a screen that showed all fifteen everywhere and disabled the ones that did not apply —
   * eight dead inputs in the platform scope, seven for every site administrator. The codebase's own
   * rule for this is in `PlatformAccess`: the admin HIDES a control rather than rendering one that
   * fails when pressed.
   *
   * A single-tenant deployment shows everything, undivided — there is no second scope to split by,
   * and splitting one would invent a distinction the operator does not have.
   *
   * Visibility is NOT writability. A platform admin inside a site may still WRITE a platform key (the
   * API routes it to the platform row), but the control lives in the platform scope, so it is not
   * shown here. `handleSave` must therefore require BOTH.
   */
  shown(key: string): boolean {
    if (!this.tenantMode) return true;
    // An INHERITED key belongs in BOTH scopes and means something different in each: the platform's
    // value, and this site's override of it. It is the one key the scope split does not divide.
    if (this.isInherited(key)) return true;
    return this.siteSelected ? !this.keys.has(key) : this.keys.has(key);
  }

  /** Is a site selected? `false` is the platform scope, and on a single-tenant deployment there is no scope at all. */
  isSiteScope(): boolean {
    return this.tenantMode && this.siteSelected;
  }

  /**
   * One line telling the operator where the settings this screen is NOT showing actually live.
   *
   * Hiding a control must not make the setting undiscoverable — that would trade one Rule Zero
   * problem for another. Empty on a single-tenant deployment, where nothing is hidden.
   */
  hiddenScopeNotice(canManagePlatform: boolean): string {
    if (!this.tenantMode) return '';
    if (!this.siteSelected) {
      return 'Site settings (name, domains, timezone, notifications, sign-in) are set inside each site — choose one from the site menu.';
    }
    return canManagePlatform
      ? 'Platform settings (URLs, marketplace, repository, indexing) live in Platform scope.'
      : 'Platform settings (URLs, marketplace, repository, indexing) live in Platform scope and are managed by a platform administrator.';
  }
}
