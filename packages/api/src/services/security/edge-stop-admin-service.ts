import { AuditOutcome, EdgeStopStore, NetworkAddressUtils, SystemConstants } from '@fromcode119/core';
import type { IEdgeStopRecord } from '@fromcode119/core';
import { GatewayReloadClient } from '@api/services/tenants/gateway-reload-client';

/**
 * Settings → Security → Stopped addresses: the list, "Release" and "Block for good".
 *
 * Either action ends the stop and tells the gateway at once (the routing map no longer carries it).
 * "Block for good" also adds the address to the platform's Blocked addresses — the same setting the
 * Edge protection card edits, saved the way that card saves it, so the address is refused on every site
 * until somebody removes it there.
 */
export class EdgeStopAdminService {
  static readonly RELEASED = 'released';
  static readonly BLOCKED = 'blocked';

  constructor(
    private readonly manager: any,
    private readonly store: EdgeStopStore,
    private readonly gateway: GatewayReloadClient = new GatewayReloadClient(),
  ) {}

  list(): Promise<IEdgeStopRecord[]> {
    return this.store.list();
  }

  /** False when there is no such stop in force. */
  async release(id: number, actor: { id?: unknown; email?: unknown }): Promise<boolean> {
    const done = await this.store.release(id, String(actor.email ?? actor.id ?? ''), EdgeStopAdminService.RELEASED);
    if (!done) return false;
    void this.manager.audit.logAction('system', 'edge.stop.release', String(id), AuditOutcome.ALLOWED, { userId: actor.id, email: actor.email });
    void this.gateway.notify();
    return true;
  }

  /** False when there is no such stop in force. */
  async block(id: number, actor: { id?: unknown; email?: unknown }): Promise<boolean> {
    const stop = await this.store.find(id);
    if (!stop || !stop.active) return false;
    const key = SystemConstants.META_KEY.EDGE_BLOCKED_ADDRESSES;
    const previous = await this.platformValue(key);
    const entries = String(previous ?? '').split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean);
    if (!NetworkAddressUtils.matchesAny(stop.address, entries)) {
      const next = [...entries, stop.address].join('\n');
      await this.writePlatformValue(key, next);
      void this.manager.audit.logAction('system', 'settings.update', key, AuditOutcome.ALLOWED, { userId: actor.id, email: actor.email, from: previous ?? null, to: next });
      // The same announcement a settings save makes: every api process re-reads, and the gateway is told.
      this.manager.hooks.emit('system:settings:updated', { keys: [key], writes: [{ key, tenantId: null }] });
    }
    await this.store.release(id, String(actor.email ?? actor.id ?? ''), EdgeStopAdminService.BLOCKED);
    void this.manager.audit.logAction('system', 'edge.stop.block', stop.address, AuditOutcome.ALLOWED, { userId: actor.id, email: actor.email });
    void this.gateway.notify();
    return true;
  }

  private async platformValue(key: string): Promise<string | undefined> {
    const db = this.manager.db;
    return db.withPlatformAdmin(async () => {
      const rows = await db.queryRaw(`SELECT "value" FROM "${SystemConstants.TABLE.META}" WHERE "key" = $1 AND "tenant_id" IS NULL LIMIT 1`, [key]);
      return rows[0] ? String(rows[0].value ?? '') : undefined;
    });
  }

  private async writePlatformValue(key: string, value: string): Promise<void> {
    const db = this.manager.db;
    await db.withPlatformAdmin(() => db.queryRaw(
      `INSERT INTO "${SystemConstants.TABLE.META}" ("key", "value", "updated_at", "tenant_id") VALUES ($1, $2, $3, NULL) `
      + 'ON CONFLICT ("key", "tenant_id") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = EXCLUDED."updated_at"',
      [key, value, new Date()],
    ));
  }
}
