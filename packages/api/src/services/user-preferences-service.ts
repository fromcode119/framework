import { RequestContextUtils, SystemConstants } from '@fromcode119/core';
import { IDatabaseManager } from '@fromcode119/database';

/**
 * Per-user UI preferences (saved views, layout choices) — small JSON blobs keyed by
 * `userpref:<userId>:<key>` in `_system_meta`. Always scoped to the AUTHENTICATED user: the key
 * namespace embeds the user id, so nobody can read or write another user's preferences. Values are
 * size-capped; this is a preferences store, not a data store.
 */
export class UserPreferencesService {
  private static readonly KEY_RE = /^[a-z0-9_.-]{1,64}$/i;
  private static readonly MAX_VALUE_BYTES = 16_384;

  constructor(private readonly db: IDatabaseManager) {}

  private metaKey(userId: number, key: string): string {
    return `userpref:${userId}:${key}`;
  }

  private validate(userId: number, key: string): boolean {
    return Number.isFinite(userId) && userId > 0 && UserPreferencesService.KEY_RE.test(key);
  }

  async get(userId: number, key: string): Promise<{ value: unknown }> {
    if (!this.validate(userId, key)) return { value: null };
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: this.metaKey(userId, key) }).catch(() => null);
    if (!row) return { value: null };
    try { return { value: JSON.parse(String((row as any).value ?? 'null')) }; } catch { return { value: null }; }
  }

  async set(userId: number, key: string, value: unknown): Promise<{ success: boolean; error?: string }> {
    if (!this.validate(userId, key)) return { success: false, error: 'invalid_key' };
    const serialized = JSON.stringify(value ?? null);
    if (serialized.length > UserPreferencesService.MAX_VALUE_BYTES) return { success: false, error: 'value_too_large' };
    const metaKey = this.metaKey(userId, key);
    const write = async (): Promise<void> => {
      const existing = await this.db.findOne(SystemConstants.TABLE.META, { key: metaKey }).catch(() => null);
      if (existing) {
        await this.db.update(SystemConstants.TABLE.META, { key: metaKey }, { value: serialized, updated_at: new Date() });
      } else {
        await this.db.insert(SystemConstants.TABLE.META, { key: metaKey, value: serialized, group: 'User Preferences', updated_at: new Date() });
      }
    };
    // Inside a site the preference is that site's row. Outside one it is the platform's row, which
    // row-level security accepts only inside a platform-admin write — the same bracket the account's
    // own rows are written in. Without it every save in the platform scope failed ("new row violates
    // row-level security policy"), so a dashboard arranged there reset on the next load.
    if (RequestContextUtils.getTenantId()) await write();
    else await this.db.withPlatformAdmin(write);
    return { success: true };
  }
}
