import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * What one of a site's hosts ANSWERS WITH — declared by the operator, never inferred from its name.
 *
 * It exists to delete a piece of magic. The gateway used to decide by reading the hostname: a host
 * beginning `api.` was sent to the api, and everything else followed the tenant's kind. Nothing said
 * so on any screen. Name a shop's alias `api.shop.com` and it silently stopped being a storefront;
 * want a dedicated api host and you had to guess that one prefix was special. A value no admin field
 * produced and no operator could change is exactly what this platform does not allow.
 *
 * Now the role is data. A host is a storefront because somebody chose that, and `backend.shop.com`
 * can be the console because somebody chose that — the name carries no meaning of its own.
 *
 * The member carries the i18n KEY, never the label: copy lives in the locale files.
 */
export class TenantHostRole extends Enum {
  /** The site's public pages. The default for a site's hosts. */
  static readonly STOREFRONT = new TenantHostRole('storefront', 'tenants.hostRole.storefront');

  /** The management console for this site or workspace. The default for a workspace's hosts. */
  static readonly ADMIN = new TenantHostRole('admin', 'tenants.hostRole.admin');

  /** The api, for device and app traffic that wants its own hostname. */
  static readonly API = new TenantHostRole('api', 'tenants.hostRole.api');

  private constructor(value: string, readonly translationKey: string) {
    super(value);
  }

  /** The member a stored value names, or null when it names one nobody listed here. */
  static find(value: unknown): TenantHostRole | null {
    if (value instanceof TenantHostRole) return value;
    return (TenantHostRole.fromValue(String(value ?? '').trim().toLowerCase()) as TenantHostRole | undefined) ?? null;
  }

  /**
   * What a host answers with when nobody has declared anything for it.
   *
   * The tenant's own kind, and nothing else — a workspace IS a console, a site IS a storefront. No
   * part of the hostname is consulted, which is the whole point.
   */
  static defaultFor(isWorkspace: boolean): TenantHostRole {
    return isWorkspace ? TenantHostRole.ADMIN : TenantHostRole.STOREFRONT;
  }

  /** What an operator picks from, in the order the choices are worth reading. */
  static options(): Array<{ value: string; translationKey: string }> {
    return TenantHostRole.values<TenantHostRole>().map((member) => ({
      value: String(member.value),
      translationKey: member.translationKey,
    }));
  }
}
