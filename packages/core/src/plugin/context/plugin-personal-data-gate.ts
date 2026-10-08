import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { ContextSecurityProxy } from '@core/plugin/context/utils';
import type { IPersonalDataSubject } from '@core/plugin/services/interfaces/personal-data-subject.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMembership } from '@core/tenant/tenant-membership';
import { TenantMode } from '@core/tenant/tenant-mode';
import { StringUtils } from '@core/utils/string-utils';
import { PersonalDataSubjectReader } from '@core/plugin/services/people/personal-data-subject-reader';
import { PluginAccountRoles } from '@core/plugin/context/plugin-account-roles';

/**
 * Who may run `context.people.personalData`'s exports and erasures, and against whom.
 *
 * Erasure tombstones the account (email, username, roles), ends its sessions and drops its membership
 * — exactly what a data-subject request needs, and exactly what locks an administrator out when any
 * plugin can aim it at user 1. It needed no capability at all.
 *
 * - Export needs `database:read`; erasure needs `database:write` (the data-protection plugin declares
 *   `database`, which carries both).
 * - Erasure refuses a subject whose account is a platform administrator or holds a role the calling
 *   plugin could not grant (PluginAccountRoles), globally or on this site. Such a person's request is
 *   the operator's to carry out, not a plugin's.
 */
export class PluginPersonalDataGate {
  private static readonly OPERATION = 'context.people.personalData erasure';

  constructor(
    private readonly plugin: ILoadedPlugin,
    private readonly manager: IPluginManagerInterface,
    private readonly security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>,
  ) {}

  forExport(): void {
    if (!this.security.hasCapability('database:read')) this.security.handleViolation('database:read');
  }

  async forErasure(subject: IPersonalDataSubject): Promise<void> {
    if (!this.security.hasCapability('database:write')) this.security.handleViolation('database:write');
    try {
      for (const user of await this.accountsOf(subject)) await this.vetAccount(user);
    } catch (error) {
      this.manager.audit?.logAction?.(this.plugin.manifest.slug, 'Personal Data Erasure', 'users', 'denied');
      throw error;
    }
  }

  /** The subject's own account and any account a person row of theirs links to. */
  private async accountsOf(subject: IPersonalDataSubject): Promise<Record<string, any>[]> {
    const reader = new PersonalDataSubjectReader(this.manager.db);
    const accounts = new Map<string, Record<string, any>>();
    const direct = await reader.findUser(subject);
    if (direct) accounts.set(String(direct.id), direct);
    for (const person of await reader.findPeople(subject)) {
      const linked = person?.user_id ?? person?.userId;
      if (linked == null || accounts.has(String(linked))) continue;
      const user = await this.manager.db.findOne(SystemConstants.TABLE.USERS, { id: linked });
      if (user) accounts.set(String(user.id), user);
    }
    return [...accounts.values()];
  }

  private async vetAccount(user: Record<string, any>): Promise<void> {
    if (user.is_platform_admin === true || user.is_platform_admin === 1) {
      throw new Error(`${PluginPersonalDataGate.OPERATION} refused account ${String(user.id)}: a platform administrator.`);
    }
    const tenantId = TenantMode.isEnabled() ? String(RequestContextUtils.getTenantId() ?? '').trim() || null : null;
    const held = StringUtils.normalizeSlugList(user.roles);
    if (tenantId) {
      const row = await this.manager.db.findOne(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { user_id: String(user.id), tenant_id: tenantId });
      if (row) held.push(...TenantMembership.from(row as Record<string, unknown>).roles);
    }
    await PluginAccountRoles.vetGrant(this.manager.db, this.plugin.manifest.slug, held, tenantId, PluginPersonalDataGate.OPERATION);
  }
}
