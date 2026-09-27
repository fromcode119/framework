import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMembership } from '@core/tenant/tenant-membership';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantState } from '@core/enums/tenant-state.enum';
import { SystemConstants } from '@core/constants/system.constants';
import { StringUtils } from '@core/utils/string-utils';

/**
 * One role added to, or taken from, what an account may do ON THIS SITE — leaving its other roles alone.
 *
 * `grantSiteMembership` REPLACES the roles it is handed, which is right for provisioning a new
 * account and wrong for "also let this person see their own schedule": called with one role it would
 * demote the site's own administrator to that role. A plugin cannot merge safely itself — the roles
 * in effect live in the membership, and `users.findById` answers the account's GLOBAL column.
 *
 * With no site bound (single-site install, or a job) the account's global roles ARE its roles, so
 * the global junction + column are edited instead — through the caller's own assign/remove.
 */
export class SiteRoleEditor {
  constructor(
    private readonly manager: IPluginManagerInterface,
    private readonly global: { assign(uid: number, slug: string): Promise<void>; remove(uid: number, slug: string): Promise<void> },
  ) {}

  /** The roles in effect here; `null` when the account is not an active member of this site. */
  async rolesOf(userId: number | string): Promise<string[] | null> {
    const uid = Number(userId);
    if (!uid) return null;
    const tenantId = SiteRoleEditor.boundSite();
    if (!tenantId) {
      const user = await this.manager.db.findOne(SystemConstants.TABLE.USERS, { id: uid }).catch(() => null);
      return user ? StringUtils.normalizeSlugList((user as any).roles) : null;
    }
    const membership = await this.membership(uid, tenantId);
    return membership?.isActive ? membership.roles : null;
  }

  /** Adds `slug`; makes the account an (active) member of this site if it was not one. */
  async add(userId: number | string, slug: string): Promise<void> {
    const uid = Number(userId);
    const role = String(slug ?? '').trim().toLowerCase();
    if (!uid || !role) return;
    const tenantId = SiteRoleEditor.boundSite();
    if (!tenantId) return this.global.assign(uid, role);
    const membership = await this.membership(uid, tenantId);
    const kept = membership?.isActive ? membership.roles : [];
    await this.write(uid, tenantId, StringUtils.normalizeSlugList([...kept, role]), !!membership);
  }

  /** Takes `slug` away; the membership and every other role stay. */
  async remove(userId: number | string, slug: string): Promise<void> {
    const uid = Number(userId);
    const role = String(slug ?? '').trim().toLowerCase();
    if (!uid || !role) return;
    const tenantId = SiteRoleEditor.boundSite();
    if (!tenantId) return this.global.remove(uid, role);
    const membership = await this.membership(uid, tenantId);
    if (!membership || !membership.roles.includes(role)) return;
    await this.manager.db.update(
      SystemConstants.TABLE.TENANT_MEMBERSHIPS,
      { user_id: String(uid), tenant_id: tenantId },
      { roles: membership.roles.filter((held) => held !== role) },
    );
  }

  private async write(uid: number, tenantId: string, roles: string[], exists: boolean): Promise<void> {
    if (exists) {
      await this.manager.db.update(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { user_id: String(uid), tenant_id: tenantId }, { roles, state: TenantState.ACTIVE.value });
      return;
    }
    await this.manager.db.insert(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { user_id: String(uid), tenant_id: tenantId, roles, state: TenantState.ACTIVE.value });
  }

  private async membership(uid: number, tenantId: string): Promise<TenantMembership | null> {
    const row = await this.manager.db.findOne(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { user_id: String(uid), tenant_id: tenantId });
    return row ? TenantMembership.from(row as Record<string, unknown>) : null;
  }

  private static boundSite(): string {
    if (!TenantMode.isEnabled()) return '';
    return String(RequestContextUtils.getTenantId() ?? '').trim();
  }
}
