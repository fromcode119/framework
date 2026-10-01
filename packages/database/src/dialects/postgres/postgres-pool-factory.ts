import { Pool } from 'pg';
import { PostgresTenantSession } from '@database/dialects/postgres/tenant/tenant-session';
import { PlatformPool } from '@database/tenant/platform-pool';
import { DatabasePoolRegistry } from '@database/pool/database-pool-registry';

/** Opens a Postgres pool the way every database manager needs it. */
export class PostgresPoolFactory {
  static open(connectionString: string): Pool {
    const pool = new Pool({ connectionString });
    // Every physical connection starts in its pool's SIGNED resting state — `none` for the request pool,
    // `platform` for the DDL pool (markAsPlatformConnection) — decided when it connects, so the mark set
    // after construction still applies. Unsigned, a connection sees nothing (TenantBindingSql).
    pool.on('connect', (client: any) => {
      PostgresTenantSession.markResting(client, PlatformPool.marks(pool));
    });
    // Counted from the start, so a request queued for a connection can be seen (DatabasePoolWatch).
    DatabasePoolRegistry.add(pool);
    return pool;
  }
}
