import { createHash, randomBytes } from 'crypto';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { PluginPasswordSetup } from '@core/plugin/context/plugin-password-setup';
import { ApiPathUtils } from '@core/api/api-path-utils';
import { SystemApiPaths } from '@core/constants/system-api-paths.constants';

/**
 * A sign-in link for an account a PLUGIN looks after — `context.users.issueSignInLink`.
 *
 * A reader who signs up from a phone (an Instagram in-app browser, a mail app's web view) has no password
 * and no shared session with their real browser. The plugin emails them this link; opening it on any
 * device signs them in and lands them on the page the plugin named. Plugins cannot start sessions
 * themselves (context.auth mints no tokens), so the framework's own auth route consumes the link.
 *
 * Only for an account the plugin could have created — the same rule as `issuePasswordSetup`. The link is
 * bound to the site it was issued on, and it keeps working until it expires: mail scanners open links
 * before the person does, and a single-use link would be spent by the scanner. `ttlMinutes: 0` asks for a
 * link that never expires (`expiresAt: null`); it still stops working when a newer link is issued for the
 * account, so the plugin's "send me a new link" retires a forwarded one.
 */
export class PluginSignInLink {
  static readonly OPERATION = 'context.users.issueSignInLink';
  static readonly MIN_MINUTES = 5;
  static readonly MAX_MINUTES = 3 * 24 * 60;
  static readonly DEFAULT_MINUTES = 24 * 60;
  /** `ttlMinutes` value that asks for a link with no expiry. */
  static readonly NEVER_EXPIRES = 0;

  static tokenKey(tokenHash: string): string {
    return `auth:sign_in_token:${tokenHash}`;
  }

  static userKey(userId: number): string {
    return `user:${userId}:sign_in_token_hash`;
  }

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Only a path on this site: `/x`, never `//host` or an absolute URL. Anything else lands on `/`. */
  static safeNext(next: unknown): string {
    const value = String(next ?? '').trim();
    if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
    return value;
  }

  static async issue(
    manager: IPluginManagerInterface,
    pluginSlug: string,
    userId: unknown,
    tenantId: string | null,
    options: { ttlMinutes?: number; next?: string } = {},
  ): Promise<{ token: string; expiresAt: string | null; path: string }> {
    const { uid, email } = await PluginPasswordSetup.vetAccount(manager, pluginSlug, userId, tenantId, PluginSignInLink.OPERATION);

    const token = randomBytes(32).toString('hex');
    const tokenHash = PluginSignInLink.hash(token);
    const minutes = PluginSignInLink.minutes(options.ttlMinutes);
    const expiresAt = minutes === null ? null : new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const payload = JSON.stringify({ userId: uid, email, tenantId, next: PluginSignInLink.safeNext(options.next), expiresAt });

    // One live link per account: a new one retires the previous.
    await manager.db.withPlatformAdmin(async () => {
      const previous = await manager.db.findOne(SystemConstants.TABLE.META, { key: PluginSignInLink.userKey(uid) });
      const previousHash = String(previous?.value ?? '').trim();
      if (previousHash && previousHash !== tokenHash) {
        await manager.db.delete(SystemConstants.TABLE.META, { key: PluginSignInLink.tokenKey(previousHash) });
      }
      await PluginSignInLink.upsert(manager, PluginSignInLink.tokenKey(tokenHash), payload);
      await PluginSignInLink.upsert(manager, PluginSignInLink.userKey(uid), tokenHash);
    });
    return { token, expiresAt, path: PluginSignInLink.path(token) };
  }

  /** The site-relative address that consumes a link — prefix it with the site's own base URL. */
  static path(token: string): string {
    return `${ApiPathUtils.versioned(SystemApiPaths.ALL.AUTH.SIGN_IN_LINK)}?token=${encodeURIComponent(token)}`;
  }

  /** Has this stored link run out? A link stored with `expiresAt: null` never does. */
  static isExpired(expiresAt: unknown, now = Date.now()): boolean {
    if (expiresAt === null) return false;
    return new Date(String(expiresAt)).getTime() < now;
  }

  /** Is the stored expiry readable — `null` (never) or a date? Anything else is a damaged record. */
  static isReadableExpiry(expiresAt: unknown): boolean {
    if (expiresAt === null) return true;
    return !Number.isNaN(new Date(String(expiresAt ?? '')).getTime());
  }

  private static minutes(requested: unknown): number | null {
    if (requested === undefined || requested === null || requested === '') return PluginSignInLink.DEFAULT_MINUTES;
    const value = Number(requested);
    if (!Number.isFinite(value)) return PluginSignInLink.DEFAULT_MINUTES;
    if (value === PluginSignInLink.NEVER_EXPIRES) return null;
    return Math.min(PluginSignInLink.MAX_MINUTES, Math.max(PluginSignInLink.MIN_MINUTES, Math.round(value)));
  }

  private static async upsert(manager: IPluginManagerInterface, key: string, value: string): Promise<void> {
    const existing = await manager.db.findOne(SystemConstants.TABLE.META, { key });
    if (existing) await manager.db.update(SystemConstants.TABLE.META, { key }, { value });
    else await manager.db.insert(SystemConstants.TABLE.META, { key, value });
  }
}
