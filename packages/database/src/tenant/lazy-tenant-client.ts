import type { PoolClient } from 'pg';
import type { OneShotTenantClient } from '@database/tenant/one-shot-tenant-client';

/**
 * What the executors and drizzle see as "the request's client": the pg `query` surface, backed by
 * a pooled client that is taken on the first call (see TenantConnectionScope). Drizzle's
 * node-postgres driver and the raw executors only ever call `query`, so this is the whole contract.
 */
export class LazyTenantClient {
  private static readonly BEGIN = /^\s*(begin|start\s+transaction)\b/i;
  private static readonly END = /^\s*(commit|rollback|end)\b/i;

  constructor(private readonly acquire: () => Promise<PoolClient | OneShotTenantClient>, private readonly onTransaction: (open: boolean) => void = () => undefined) {}

  async query(...args: unknown[]): Promise<any> {
    const client = await this.acquire();
    const text = typeof args[0] === 'string' ? args[0] : String((args[0] as { text?: string } | undefined)?.text ?? '');
    // A transaction lives on ONE connection. Noting BEGIN/COMMIT here is what lets the scope refuse to
    // hand the client back to the pool while one is open (see TenantConnectionScope.releaseCurrent).
    if (LazyTenantClient.BEGIN.test(text)) this.onTransaction(true);
    else if (LazyTenantClient.END.test(text)) this.onTransaction(false);
    return (client.query as (...params: unknown[]) => Promise<any>)(...args);
  }
}
