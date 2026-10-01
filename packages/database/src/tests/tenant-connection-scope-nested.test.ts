import { describe, expect, it } from 'vitest';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';
import { TenantBindingKey } from '@database/dialects/postgres/tenant/tenant-binding-key';
import { TenantBindingSql } from '@database/dialects/postgres/tenant/tenant-binding-sql';

TenantBindingKey.use('test-key');

/** A client that goes back to its pool when released. */
class PooledClient {
  readonly processID: number;
  constructor(readonly id: number, private readonly pool: BoundedPool) { this.processID = 2000 + id; }
  async query(text: string) {
    return { rows: text === TenantBindingSql.openStatement() ? [{ nonce: `nonce-${this.processID}` }] : [] };
  }
  release() { this.pool.giveBack(this); }
}

/** Like pg's Pool: at most `max` clients out; a further `connect` waits until one comes back. */
class BoundedPool {
  private readonly idle: PooledClient[] = [];
  private readonly waiting: Array<(client: PooledClient) => void> = [];
  private created = 0;
  constructor(private readonly max: number) {}
  async connect(): Promise<any> {
    const idle = this.idle.pop();
    if (idle) return idle;
    if (this.created < this.max) return new PooledClient(++this.created, this);
    return new Promise((resolve) => this.waiting.push(resolve));
  }
  giveBack(client: PooledClient) {
    const next = this.waiting.shift();
    if (next) next(client); else this.idle.push(client);
  }
}

const within = <T>(promise: Promise<T>, ms = 500) => Promise.race([
  promise,
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error('deadlocked')), ms)),
]);

describe('a scope opened inside another on the same pool', () => {
  it('does not hold the outer client while it waits for its own — a 1-client pool still completes', async () => {
    const pool = new BoundedPool(1);
    const result = await within(TenantConnectionScope.run(pool as any, 'site-a', async () => {
      await TenantConnectionScope.currentClient()!.query('select site row');
      const platform = await TenantConnectionScope.runAsPlatformAdmin(pool as any, async () => {
        await TenantConnectionScope.currentClient()!.query('select platform row');
        return 'platform-row';
      });
      // The outer scope carries on, on a fresh client bound to its site again.
      await TenantConnectionScope.currentClient()!.query('select another site row');
      return platform;
    }));
    expect(result).toBe('platform-row');
  });

  it('keeps the outer client mid-transaction — the transaction lives on that connection', async () => {
    const pool = new BoundedPool(2);
    const outerClients: unknown[] = [];
    await within(TenantConnectionScope.run(pool as any, 'site-a', async () => {
      const outer = TenantConnectionScope.currentClient()!;
      await outer.query('BEGIN');
      outerClients.push(await (outer as any).acquire());
      await TenantConnectionScope.runAsPlatformAdmin(pool as any, async () => {
        await TenantConnectionScope.currentClient()!.query('select platform row');
      });
      outerClients.push(await (TenantConnectionScope.currentClient() as any).acquire());
      await outer.query('COMMIT');
    }));
    expect(outerClients[0]).toBe(outerClients[1]);
  });
});
