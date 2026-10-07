import { RoleCatalog } from '@core/tenant/role-catalog';
import { StringUtils } from '@core/utils/string-utils';

/**
 * The roles a PLUGIN may put on an account it creates through `context.users.create`.
 *
 * The caller chooses the email, the roles, and the password — already hashed, so it is a hash the
 * plugin knows. Unvetted, that is a plugin minting an administrator login for itself: a new account
 * with `roles: ['admin']` and a password only the plugin can type. Plugins create the people their
 * product serves — customers, partners, their own staff — and none of those needs a role that reaches
 * past the plugin itself, so such a role is refused outright rather than quietly swapped for a lesser
 * one: a caller that asked for an administrator has a bug or a motive, and neither should get an account.
 *
 * Two independent tests, because the platform answers "is this an administrator?" in two ways:
 *
 * - BY NAME. Request guards check `roles.includes('admin')` directly, whatever the role row says, so an
 *   administrator's slug is refused even on a deployment that has stripped its permissions.
 * - BY WHAT IT GRANTS. Every console screen is gated on a permission, so each permission the role
 *   carries — on the platform, or on this site — must belong to the CALLING plugin (`<slug>:…`) and be
 *   no wildcard. A plugin may hand out its own screens (a booking plugin's staff role
 *   carrying `<slug>:own`), never the platform's and never another plugin's. That also catches a custom
 *   role an operator built with `*` under some unremarkable name.
 *
 * A role nobody has defined carries no permissions and is allowed: that is what `customer` is before
 * the shop declares it, and it is the default here. Fails closed: if the role catalog cannot be read, nothing
 * is created.
 */
export class PluginAccountRoles {
  /** The account type when the caller names none. */
  static readonly DEFAULT: readonly string[] = Object.freeze(['customer']);

  /** Slugs that mean "administrator" wherever a guard reads the role's NAME rather than its permissions. */
  private static readonly PRIVILEGED = new Set([
    'admin', 'administrator', 'superadmin', 'super-admin', 'super_admin', 'owner', 'root', 'sysadmin',
    'platform-admin', 'platform_admin', 'platformadmin',
  ]);

  /**
   * The framework's own permission namespaces. A plugin whose slug happens to be one of these does not
   * thereby own `users:manage` or `system:backup:restore`, so its slug grants it no namespace at all.
   */
  private static readonly FRAMEWORK_NAMESPACES = new Set([
    'admin', 'api', 'auth', 'backups', 'content', 'database', 'email', 'frontend', 'hooks', 'i18n',
    'integrations', 'media', 'monitoring', 'networking', 'platform', 'plugins', 'roles', 'security',
    'settings', 'sites', 'storage', 'system', 'tenants', 'users',
  ]);

  /**
   * The normalized roles to grant, or throws naming the ones refused.
   *
   * Normalized BEFORE the check and stored normalized: every reader lowercases and trims, so ` Admin `
   * compared raw would slip past this and still read as `admin` everywhere that matters.
   */
  static async vet(db: unknown, pluginSlug: string, requested: unknown, tenantId: string | null): Promise<string[]> {
    const named = Array.isArray(requested) ? StringUtils.normalizeSlugList(requested) : [];
    const roles = named.length ? named : [...PluginAccountRoles.DEFAULT];

    const byName = roles.filter((role) => PluginAccountRoles.PRIVILEGED.has(role));
    if (byName.length) throw PluginAccountRoles.refusal(byName);

    const catalog = await new RoleCatalog(db).list(tenantId);
    const owns = PluginAccountRoles.ownership(pluginSlug);
    const byGrant = roles.filter((role) => catalog.some((entry) => entry.slug === role && !entry.permissions.every(owns)));
    if (byGrant.length) throw PluginAccountRoles.refusal(byGrant);

    return roles;
  }

  /** Whether a permission sits inside the calling plugin's own namespace, wildcards excluded. */
  private static ownership(pluginSlug: string): (permission: string) => boolean {
    const slug = String(pluginSlug ?? '').trim().toLowerCase();
    if (!slug || PluginAccountRoles.FRAMEWORK_NAMESPACES.has(slug)) return () => false;
    return (permission) => permission.startsWith(`${slug}:`) && !permission.includes('*');
  }

  private static refusal(roles: string[]): Error {
    return new Error(
      `context.users.create refused role(s) ${roles.map((role) => `"${role}"`).join(', ')}: a plugin may only create accounts `
      + 'whose roles carry nothing beyond its own permissions, and never an administrator.',
    );
  }
}
