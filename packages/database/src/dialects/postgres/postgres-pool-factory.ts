import { Pool } from 'pg';
import { PostgresTenantSession } from '@database/dialects/postgres/tenant/tenant-session';
import { PlatformPool } from '@database/tenant/platform-pool';
import { DatabasePoolRegistry } from '@database/pool/database-pool-registry';
import { PreparedStatements } from '@database/dialects/postgres/prepared-statements';

/** Opens a Postgres pool the way every database manager needs it. */
export class PostgresPoolFactory {
  /**
   * How long an unused connection is kept. `pg` closes one after 10 s by default, and every new
   * connection opens its signed binding first (creating its temp table): on a quiet site the first
   * request after a pause paid for that again — measured at ~23 ms of database time on a small server.
   * The pool's size still bounds how many are held.
   */
  static readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000;

  static open(connectionString: string): Pool {
    const pool = new Pool({ connectionString, idleTimeoutMillis: PostgresPoolFactory.IDLE_TIMEOUT_MS });
    // Every physical connection starts in its pool's SIGNED resting state — `none` for the request pool,
    // `platform` for the DDL pool (markAsPlatformConnection) — decided when it connects, so the mark set
    // after construction still applies. Unsigned, a connection sees nothing (TenantBindingSql).
    pool.on('connect', (client: any) => {
      PreparedStatements.install(client);
      PostgresTenantSession.markResting(client, PlatformPool.marks(pool));
    });
    // Counted from the start, so a request queued for a connection can be seen (DatabasePoolWatch).
    DatabasePoolRegistry.add(pool);
    return pool;
  }
}
