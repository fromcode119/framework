import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Who a system setting's value is FOR: the whole deployment, or one site on it.
 *
 * This is a property of what READS the setting — never of what an operator chose, never stored, never
 * inferred at runtime from whether a request happens to carry a tenant. See
 * {@link SystemSettingRegistry}, the one place every key is assigned one of these.
 */
export class SettingScope extends Enum {
  /** Read at boot, in the background, or by platform infrastructure — one value for every site. */
  static readonly PLATFORM = new SettingScope('platform');
  /** Read for the site the request is about — one value per site. */
  static readonly SITE = new SettingScope('site');
  /**
   * The platform's value, which any site may override with its own.
   *
   * Not a third storage shape — the same one. `_system_meta` is keyed `(key, tenant_id)`, so a site's
   * row and the platform's already coexist under ONE key, and the table's policy already lets a tenant
   * read the platform's row for every key on the platform list while its `WITH CHECK` stops a tenant
   * writing that row. Inheritance was therefore always available; what was missing was permission to
   * say a key wanted it, so a second key got invented to mean "the site's copy of this one".
   *
   * Counts as PLATFORM wherever a platform row is what matters — the row-level policy's allowlist, and
   * the guard that stops platform code reading a site-only key. It differs only in the admin: the
   * control appears in BOTH scopes, and each scope writes its own row.
   */
  static readonly INHERITED = new SettingScope('inherited');

  private constructor(value: string) {
    super(value);
  }

  /**
   * Does this key have a PLATFORM row?
   *
   * True for INHERITED as well as PLATFORM, and both callers want exactly that: the row-level policy
   * publishes the platform row for these keys, and `PlatformSettingsService` may read them. What
   * INHERITED adds is a site row alongside — which is an admin-layer distinction, not this one.
   */
  get isPlatform(): boolean {
    return this === SettingScope.PLATFORM || this === SettingScope.INHERITED;
  }

  /** May each site override the platform's value with one of its own? */
  get isInherited(): boolean {
    return this === SettingScope.INHERITED;
  }
}
