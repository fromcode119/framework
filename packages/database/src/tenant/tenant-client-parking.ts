import type { Pool, PoolClient } from 'pg';
import type { ITenantScopeLease } from '@database/interfaces/tenant-scope-lease.interface';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';

/**
 * A lease that parks ONE client, still bound to its site, between the runs of an invocation.
 *
 * An isolated plugin serving one request calls back into the api statement by statement, and each
 * call used to be a scope of its own: take a client, bind it to the site, run the statement, clear the
 * binding, give it back. The binding and the clearing are round trips of their own, so most of a
 * plugin's database time went on them. Parked, the client is bound once per invocation.
 *
 * What keeps this as safe as the per-call scope:
 *  - The parking belongs to ONE invocation of ONE site; `run` binds a fresh client to that site only.
 *  - A run takes the parked client EXCLUSIVELY. Two runs at once each hold their own client, so a
 *    transaction one of them opens never absorbs the other's statements.
 *  - A client is only parked between runs with no transaction open and nothing still acquiring.
 *  - It is never parked while anybody is queued for the pool, and never left parked longer than
 *    `IDLE_MS`: a guest busy with something else (a courier request, a template render) must not
 *    keep a connection another request is waiting for.
 *  - `close` — when the invocation's token is revoked — gives it back; a run still going when that
 *    happens gives its client back itself instead of parking it.
 * Everything handed back goes through the scope's own clear-then-release, so a client whose binding
 * cannot be cleared is destroyed, never lent on.
 */
export class TenantClientParking implements ITenantScopeLease {
  static readonly IDLE_MS = 50;
  private parked: PoolClient | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(readonly pool: Pool, readonly tenantId: string) {
    if (!String(tenantId ?? '').trim()) {
      throw new Error('TenantClientParking: empty tenant id; refusing to park an untenanted client.');
    }
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    return TenantConnectionScope.runParked(this, fn);
  }

  /** The parked client, taken exclusively — or null, and the run binds its own. */
  take(): PoolClient | null {
    this.stopTimer();
    const client = this.parked;
    this.parked = null;
    return client;
  }

  /** Keeps `client` for the next run; false when it must be handed back instead. */
  park(client: PoolClient): boolean {
    if (this.closed || this.parked || (this.pool as { waitingCount?: number }).waitingCount) return false;
    this.parked = client;
    this.timer = setTimeout(() => { void this.giveBack(); }, TenantClientParking.IDLE_MS);
    this.timer.unref?.();
    return true;
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.giveBack();
  }

  private async giveBack(): Promise<void> {
    const client = this.take();
    if (client) await TenantConnectionScope.handBack(this.pool, client);
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
