import { createHash, randomBytes } from 'crypto';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMembership } from '@core/tenant/tenant-membership';
import { StringUtils } from '@core/utils/string-utils';
import { PluginAccountRoles } from '@core/plugin/context/plugin-account-roles';

/**
 * A set-password link for an account a PLUGIN looks after — `context.users.issuePasswordSetup`.
 *
 * Plugins that create logins (a partner programme, a portal) need to send the person a link to choose
 * their password. They used to do it by writing the framework's reset-token rows into `_system_meta`
 * by hand, and the same write let ANY plugin mint a reset link for the administrator and take the
 * account over. Plugins can no longer write those keys (PluginMetaAccess); this issues the token
 * instead, in exactly the format the framework's own reset page consumes.
 *
 * Only for an account the plugin could have created: one that holds nothing beyond roles the plugin may
 * grant (PluginAccountRoles), globally and on this site, and is not a platform administrator. Anyone
 * else's password is theirs to reset through "forgot password".
 */
export class PluginPasswordSetup {
  private static readonly OPERATION = 'context.users.issuePasswordSetup';
  private static readonly MIN_MINUTES = 5;
  private static readonly MAX_MINUTES = 7 * 24 * 60;
  private static readonly DEFAULT_MINUTES = 24 * 60;

  static async issue(
    manager: IPluginManagerInterface,
    pluginSlug: string,
    userId: unknown,
    tenantId: string | null,
    options: { ttlMinutes?: number } = {},
  ): Promise<{ token: string; expiresAt: string }> {
    const uid = Number(userId);
    const refuse = (why: string): never => { throw new Error(`${PluginPasswordSetup.OPERATION} refused account ${String(userId)}: ${why}`); };
    if (!Number.isFinite(uid) || uid <= 0) refuse('no such account');

    const user = await manager.db.findOne(SystemConstants.TABLE.USERS, { id: uid });
    const email = String(user?.email ?? '').trim().toLowerCase();
    if (!user || !email.includes('@')) refuse('no such account');
    if (user.is_platform_admin === true || user.is_platform_admin === 1) refuse('a platform administrator');

    const held = StringUtils.normalizeSlugList(user.roles);
    if (tenantId) {
      const row = await manager.db.findOne(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { user_id: String(uid), tenant_id: tenantId });
      if (!row) refuse('not a member of this site');
      held.push(...TenantMembership.from(row as Record<string, unknown>).roles);
    }
    await PluginAccountRoles.vetGrant(manager.db, pluginSlug, held, tenantId, PluginPasswordSetup.OPERATION);

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + PluginPasswordSetup.minutes(options.ttlMinutes) * 60 * 1000).toISOString();
    const hashKey = `user:${uid}:password_reset_token_hash`;

    // Platform rows, as the framework's own reset flow writes and reads them; a previous link stops working.
    await manager.db.withPlatformAdmin(async () => {
      const previous = await manager.db.findOne(SystemConstants.TABLE.META, { key: hashKey });
      const previousHash = String(previous?.value ?? '').trim();
      if (previousHash && previousHash !== tokenHash) {
        await manager.db.delete(SystemConstants.TABLE.META, { key: `auth:password_reset_token:${previousHash}` });
      }
      await PluginPasswordSetup.upsert(manager, `auth:password_reset_token:${tokenHash}`, JSON.stringify({ userId: uid, email, expiresAt }));
      await PluginPasswordSetup.upsert(manager, hashKey, tokenHash);
    });
    return { token, expiresAt };
  }

  private static minutes(requested: unknown): number {
    const value = Number(requested);
    if (!Number.isFinite(value)) return PluginPasswordSetup.DEFAULT_MINUTES;
    return Math.min(PluginPasswordSetup.MAX_MINUTES, Math.max(PluginPasswordSetup.MIN_MINUTES, Math.round(value)));
  }

  private static async upsert(manager: IPluginManagerInterface, key: string, value: string): Promise<void> {
    const existing = await manager.db.findOne(SystemConstants.TABLE.META, { key });
    if (existing) await manager.db.update(SystemConstants.TABLE.META, { key }, { value });
    else await manager.db.insert(SystemConstants.TABLE.META, { key, value });
  }
}
