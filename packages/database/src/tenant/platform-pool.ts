import type { Pool } from 'pg';

/**
 * The mark that says a pool's every client acts for the PLATFORM — the DDL/migration pool.
 *
 * On the pool rather than the manager because the scope code holds a pool, not a manager, and the
 * resting state has to be readable at the moment a client is given back. The symbol and the question
 * asked of it live together in a class: neither is a free-floating module declaration, and a caller
 * reads `PlatformPool.mark(pool)` / `PlatformPool.marks(pool)` rather than reaching for the key.
 */
export class PlatformPool {
  private static readonly KEY = Symbol.for('fromcode.platformPool');

  /** Mark this pool as the platform's. */
  static mark(pool: Pool): void {
    (pool as unknown as Record<symbol, unknown>)[PlatformPool.KEY] = true;
  }

  /** Whether this pool's clients rest with the platform-admin marker set. */
  static marks(pool: Pool): boolean {
    return (pool as unknown as Record<symbol, unknown>)[PlatformPool.KEY] === true;
  }
}
