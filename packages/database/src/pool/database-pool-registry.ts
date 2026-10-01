import type { Pool } from 'pg';
import type { IDatabasePoolSnapshot } from '@database/interfaces/database-pool-snapshot.interface';
import { PlatformPool } from '@database/tenant/platform-pool';

/**
 * The Postgres pools this process opened, so something outside the database package can see how
 * busy they are — without each dialect's manager growing a method every other dialect must stub.
 *
 * `waiting` is the number to watch: requests queued for a connection, with no query running for
 * them on the database side. A pool can be full of idle-looking connections that are all checked
 * out, which from Postgres looks exactly like a quiet api.
 */
export class DatabasePoolRegistry {
  /** pg's own default, used until the api hands over the operator's setting. */
  static readonly PG_DEFAULT_MAX = 10;

  private static readonly pools = new Set<Pool>();
  private static requestPoolMax: (() => number) | null = null;

  /**
   * Counts `pool`, and makes its size follow the operator's setting: pg reads `options.max` each time
   * it decides whether it may open another connection, so the resolver's answer applies at once. The
   * platform (DDL) pool keeps the size it was created with — one connection is all migrations need.
   */
  static add(pool: Pool): void {
    DatabasePoolRegistry.pools.add(pool);
    const options = (pool as unknown as { options: { max?: number } }).options;
    const created = Number(options.max) || DatabasePoolRegistry.PG_DEFAULT_MAX;
    Object.defineProperty(options, 'max', {
      configurable: true,
      enumerable: true,
      get: () => (PlatformPool.marks(pool) || !DatabasePoolRegistry.requestPoolMax ? created : DatabasePoolRegistry.requestPoolMax()),
    });
  }

  /** Settings → Infrastructure → Database connections, read live (ServerRuntimeLimits in the api). */
  static useRequestPoolMax(resolver: () => number): void {
    DatabasePoolRegistry.requestPoolMax = resolver;
  }

  static snapshots(): IDatabasePoolSnapshot[] {
    return [...DatabasePoolRegistry.pools].map((pool) => ({
      // Named when read: the DDL pool is marked as the platform's after it is created.
      name: PlatformPool.marks(pool) ? 'platform' : 'requests',
      max: Number((pool as unknown as { options: { max?: number } }).options.max) || DatabasePoolRegistry.PG_DEFAULT_MAX,
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    }));
  }
}
