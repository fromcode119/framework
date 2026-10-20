import { createHash, randomBytes } from 'crypto';
import { SystemConstants } from '@core/constants/system.constants';
import { SecretService } from '@core/security/secret-service';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { PluginPlatformHandoffState } from '@core/plugin/platform/enums/plugin-platform-handoff-state.enum';
import type { IDatabaseManager } from '@fromcode119/database';
import type { IPluginPlatformHandoff } from '@core/plugin/platform/interfaces/plugin-platform-handoff.interface';
import type { IPluginPlatformTicket } from '@core/plugin/platform/interfaces/plugin-platform-ticket.interface';

/**
 * Every used `context.platform` ticket, and the claim it carries until the console that asked finishes it
 * (`_system_plugin_platform_handoffs`). Framework-only, on the raw connection.
 *
 * SINGLE USE. A ticket's nonce is the row's primary key, so the second use of a ticket loses on the
 * index — two browsers racing with one ticket cannot both get past the platform part.
 *
 * NOT GRANTED HERE. The platform part runs on the API host for whoever holds the link, so it cannot tell
 * the operator who asked from anyone they — or an attacker — sent the link to. It parks the claim behind
 * a one-time handoff that only the console that asked can spend, and the framework grants it there, to
 * the signed-in account that minted the ticket (`context.platform.complete`). Only `sha256(handoff)` is
 * stored; the payload is sealed, because it can hold a provider's access token.
 */
export class PluginPlatformHandoffs {
  /** How long the console has to finish: the browser follows the redirect at once. */
  static readonly HANDOFF_LIFETIME_MS = 10 * 60 * 1000;
  /** The query parameter the handoff travels in, on the way to the tenant part's completion route. */
  static readonly QUERY_PARAM = 'handoff';
  private static readonly TABLE = SystemConstants.TABLE.PLUGIN_PLATFORM_HANDOFFS;

  constructor(private readonly db: IDatabaseManager) {}

  /** Uses `ticket` and parks its claim. Returns the raw handoff, or '' when the ticket was already used. */
  async park(ticket: IPluginPlatformTicket, keys: string[], payload: unknown, now = Date.now()): Promise<string> {
    const handoff = randomBytes(32).toString('hex');
    const handoffExpiresAt = now + PluginPlatformHandoffs.HANDOFF_LIFETIME_MS;
    const recorded = await this.record(ticket, now, {
      state: String(PluginPlatformHandoffState.PENDING.value),
      claim_keys: { keys: [...new Set((keys ?? []).map((key) => String(key ?? '').trim()).filter(Boolean))] },
      payload: payload === undefined ? null : SecretService.encrypt(JSON.stringify(payload)),
      return_to: ticket.returnTo,
      handoff_hash: PluginPlatformHandoffs.hash(handoff),
      handoff_expires_at: new Date(handoffExpiresAt),
      expires_at: new Date(Math.max(Number(ticket.exp), handoffExpiresAt)),
    });
    return recorded ? handoff : '';
  }

  /** Uses `ticket` with nothing to claim. False when it was already used. */
  async abandon(ticket: IPluginPlatformTicket, now = Date.now()): Promise<boolean> {
    return this.record(ticket, now, { state: String(PluginPlatformHandoffState.ABANDONED.value), expires_at: new Date(Number(ticket.exp)) });
  }

  /**
   * Spends `slug`'s handoff and returns what it carries, or null when it is unknown, already spent or
   * expired. Spent BEFORE the caller checks whose it is, so a handoff that reached the wrong console
   * or the wrong account is gone rather than left for another try.
   */
  async spend(slug: string, rawHandoff: unknown, now = Date.now()): Promise<IPluginPlatformHandoff | null> {
    const hash = PluginPlatformHandoffs.hash(rawHandoff);
    if (!hash) return null;
    const row = await this.db.findOne(PluginPlatformHandoffs.TABLE, { handoff_hash: hash });
    const pending = String(PluginPlatformHandoffState.PENDING.value);
    if (!row || row.plugin_slug !== slug || row.state !== pending) return null;
    // The unspent state is part of the filter, so two requests with one handoff race on the database.
    const spent = await this.db.update(
      PluginPlatformHandoffs.TABLE,
      { nonce: row.nonce, state: pending },
      { state: String(PluginPlatformHandoffState.SPENT.value), payload: null, completed_at: new Date(now) },
    );
    if (!spent || !(new Date(row.handoff_expires_at).getTime() > now)) return null;
    const sealed = String(row.payload ?? '');
    return {
      tenantId: row.tenant_id ? String(row.tenant_id) : null,
      userId: String(row.user_id ?? ''),
      keys: CoercionUtils.toParsedArray<string>(CoercionUtils.toParsedObject(row.claim_keys).keys).map(String),
      payload: sealed ? JSON.parse(SecretService.decrypt(sealed)) : null,
      returnTo: String(row.return_to ?? ''),
    };
  }

  static hash(raw: unknown): string {
    const value = String(raw ?? '').trim();
    return value ? createHash('sha256').update(value).digest('hex') : '';
  }

  /** Inserts the ticket's row. False when its nonce is already recorded — the ticket was used. */
  private async record(ticket: IPluginPlatformTicket, now: number, fields: Record<string, unknown>): Promise<boolean> {
    await this.prune(ticket.slug, now);
    try {
      await this.db.insert(PluginPlatformHandoffs.TABLE, {
        nonce: ticket.nonce,
        plugin_slug: ticket.slug,
        tenant_id: ticket.tenantId,
        user_id: ticket.userId,
        created_at: new Date(now),
        ...fields,
      });
      return true;
    } catch (error) {
      if (await this.db.findOne(PluginPlatformHandoffs.TABLE, { nonce: ticket.nonce })) return false;
      throw error;
    }
  }

  /** Drops `slug`'s rows that can do nothing any more: their ticket and their handoff have both run out. */
  private async prune(slug: string, now: number): Promise<void> {
    const rows = await this.db.find(PluginPlatformHandoffs.TABLE, { where: { plugin_slug: slug } });
    for (const row of rows ?? []) {
      if (new Date(row.expires_at).getTime() > now) continue;
      await this.db.delete(PluginPlatformHandoffs.TABLE, { nonce: row.nonce });
    }
  }
}
