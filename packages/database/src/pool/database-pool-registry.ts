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
  private static readonly pools = new Set<Pool>();

  static add(pool: Pool): void {
    DatabasePoolRegistry.pools.add(pool);
  }

  static snapshots(): IDatabasePoolSnapshot[] {
    return [...DatabasePoolRegistry.pools].map((pool) => ({
      // Named when read: the DDL pool is marked as the platform's after it is created.
      name: PlatformPool.marks(pool) ? 'platform' : 'requests',
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    }));
  }
}
