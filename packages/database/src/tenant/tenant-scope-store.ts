import type { Pool, PoolClient } from 'pg';

/**
 * Marks a pool whose every client acts for the PLATFORM — the DDL/migration pool.
 *
 * On the pool rather than the manager because the scope code holds a pool, not a manager, and the
 * resting state has to be readable at the moment a client is given back.
 */
export const PLATFORM_POOL = Symbol.for('fromcode.platformPool');

/** Whether this pool's clients rest with the platform-admin marker set. */
export function isPlatformPool(pool: Pool): boolean {
  return (pool as unknown as Record<symbol, unknown>)[PLATFORM_POOL] === true;
}

/** One open tenant scope: which pool, which tenant (or the platform-admin marker), and the client it holds right now, if any. */
export class TenantScopeStore {
  client: PoolClient | null = null;
  pending: Promise<PoolClient> | null = null;
  /** True between a `BEGIN` and its `COMMIT`/`ROLLBACK` on the held client: the client must not be given back mid-transaction. */
  inTransaction = false;
  /**
   * Set once the scope's `run` has returned and its client was given back. A statement that arrives
   * after this point belongs to work the response did not wait for; it must not re-acquire into this
   * store (see OneShotTenantClient).
   */
  closed = false;

  constructor(
    readonly pool: Pool,
    /** Null for a platform-admin scope, which runs untenanted. */
    readonly tenantId: string | null,
    readonly platformAdmin: boolean,
  ) {}
}
