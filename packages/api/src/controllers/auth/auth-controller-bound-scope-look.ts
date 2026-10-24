import { AuthControllerLoginThrottle } from '@api/controllers/auth/auth-controller-login-throttle';
import { SystemConstants, TenantKind } from '@fromcode119/core';

/** What the bound scope's console looks like — readable by every member who may enter it. */
export class AuthControllerBoundScopeLook extends AuthControllerLoginThrottle {
  /** The bound scope's appearance and shadows; both '' when no scope is bound (the platform's console). */
  protected async boundLook(tenant?: { id: string; kind: string; appearance: string }): Promise<{ appearance: string; shadows: string }> {
    if (!tenant) return { appearance: '', shadows: '' };
    return { appearance: await this.boundAppearance(tenant), shadows: await this.boundShadows(tenant) };
  }

  /**
   * The console the bound scope wears, for EVERY member who may enter it.
   *
   * A site's appearance is its own `admin_appearance` setting, and the only other place the admin could
   * read it is `/system/admin/settings`, which needs `system:manage`. A member holding a narrower role
   * (one plugin's screens, say) was refused that read and got the default console instead of the site's
   * own. Answered here from the site's own row only, the same read the Sites page makes, so a site with
   * none says '' (the built-in console) and never the platform's choice. A workspace's is its kind lock.
   */
  protected async boundAppearance(tenant: { id: string; kind: string; appearance: string }): Promise<string> {
    if (TenantKind.parse(tenant.kind)?.isWorkspace) return tenant.appearance;
    const row = await this.db.withTenant(tenant.id, () => this.db
      .findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.ADMIN_APPEARANCE })
      .catch(() => null));
    return String((row as any)?.value ?? '').trim();
  }

  /**
   * The bound site's own `admin_shadows` setting, for the same reason as its appearance: the console
   * a member wears is drawn flat or elevated by the site, and the settings route that also carries it
   * needs `system:manage`. '' when the site has none (elevated) and for a workspace, which has no such
   * setting of its own.
   */
  protected async boundShadows(tenant: { id: string; kind: string }): Promise<string> {
    if (TenantKind.parse(tenant.kind)?.isWorkspace) return '';
    const row = await this.db.withTenant(tenant.id, () => this.db
      .findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.ADMIN_SHADOWS })
      .catch(() => null));
    return String((row as any)?.value ?? '').trim();
  }
}
