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
      // A checked-out client is not covered by the pool's listener below. Without its own, a connection
      // the server closes while a request holds it between two statements crashes the process.
      client.on('error', PostgresPoolFactory.connectionLost);
      PreparedStatements.install(client);
      PostgresTenantSession.markResting(client, PlatformPool.marks(pool));
    });
    // An idle connection the server closes (a Postgres restart, an administrator's terminate) is reported
    // here. With no listener `pg` rethrows it as an uncaught exception and the whole process exits — one
    // restarted database used to take the api down with it, and any backup it was writing. The pool
    // drops that connection and opens a fresh one on the next query; there is nothing else to do.
    pool.on('error', PostgresPoolFactory.connectionLost);
    // Counted from the start, so a request queued for a connection can be seen (DatabasePoolWatch).
    DatabasePoolRegistry.add(pool);
    return pool;
  }

  private static connectionLost(error: Error): void {
    console.warn(`[database] A database connection was closed by the server and will be replaced: ${error?.message || error}`);
  }
}
