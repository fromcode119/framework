import { AsyncLocalStorage } from 'async_hooks';
import type { Pool, PoolClient } from 'pg';
import { TenantRlsSql } from '@database/tenant/tenant-rls-sql';
import { TenantScopeStore } from '@database/tenant/tenant-scope-store';
import { LazyTenantClient } from '@database/tenant/lazy-tenant-client';
import { OneShotTenantClient } from '@database/tenant/one-shot-tenant-client';

/**
 * Holds ONE pooled client for the duration of a request, with `app.tenant_id` set on it.
 *
 * Why a held client and not `SET LOCAL`: the Postgres manager issues each statement through
 * `pool.query`, which takes an arbitrary client per statement. A session-level `SET` on the pool
 * would leak the tenant to whichever request next received that client, and `SET LOCAL` only lasts
 * for a transaction. Holding one client for the request gives every statement the same session,
 * with no long-running transaction and no lock retention.
 *
 * Why the client is acquired LAZILY (on the first statement) and can be RELEASED mid-scope: with
 * isolated plugins (T5) a scope often spans a wait on another process — the api proxies a request to
 * a plugin, a plugin's call reaches into a peer plugin — and a scope that grabbed a client up front
 * held it through that wait. Ten such waits and the pool was empty; the peer then needed a client to
 * answer, and both sides waited on each other until the deadline. A scope that touches no table
 * holds nothing; a host about to wait on a guest gives its client back (`releaseCurrent`) and takes a
 * fresh one, with the tenant set again, on its next statement.
 *
 * Once the scope has CLOSED (its `run` returned, its client was given back), a statement that still
 * arrives — an audit write after the response, a handler the client aborted — runs on a
 * OneShotTenantClient: taken, tenanted, used and released within that one statement. Re-acquiring
 * into the closed store was a leak nothing could ever release (see that class).
 *
 * The client is cleared with `set_config(..., '', false)` before release. That is safe ONLY because
 * every policy compares through `nullif(..., '')`, so an empty setting matches nothing. With a bare
 * equality policy this same reset would put the connection into a phantom shared "empty tenant".
 */
export class TenantConnectionScope {
  private static readonly storage = new AsyncLocalStorage<TenantScopeStore>();

  /**
   * The connection this scope's statements must use, or undefined when not inside a scope. A lazy
   * stand-in: the pooled client behind it is taken on the first `query` and carries the scope's
   * tenant (or platform-admin marker) from then on.
   */
  static currentClient(pool?: Pool): LazyTenantClient | undefined {
    const store = TenantConnectionScope.storage.getStore();
    if (!store) return undefined;
    // A scope belongs to ONE pool. A manager on another pool — the DDL/owner connection the schema
    // manager runs on — must not borrow the request's app-role client: an ALTER TABLE issued through
    // it fails as "must be owner", which is how new plugin tables silently stayed un-isolated on every
    // discovery refresh made from an admin request. That manager takes its own pool instead.
    if (pool && store.pool !== pool) return undefined;
    return new LazyTenantClient(
      () => (store.closed ? Promise.resolve(new OneShotTenantClient(store)) : TenantConnectionScope.acquire(store)),
      (open) => { store.inTransaction = open; },
    );
  }

  static async run<T>(pool: Pool, tenantId: string, fn: () => Promise<T>): Promise<T> {
    const tenant = String(tenantId ?? '').trim();
    if (!tenant) {
      throw new Error('TenantConnectionScope.run: empty tenant id; refusing to open an untenanted scope.');
    }
    return TenantConnectionScope.open(new TenantScopeStore(pool, tenant, false), fn);
  }

  /**
   * A scope acting for a PLATFORM ADMIN: no tenant, and the marker the `_system_meta` policy's
   * WITH CHECK looks for on a tenant-less row. This is how a platform setting is written as the
   * platform's row from a request that is otherwise bound to a site. Cleared on release like the tenant.
   */
  static async runAsPlatformAdmin<T>(pool: Pool, fn: () => Promise<T>): Promise<T> {
    return TenantConnectionScope.open(new TenantScopeStore(pool, null, true), fn);
  }

  /**
   * Give the current scope's client back to the pool NOW — for a host about to wait on another
   * process. The scope stays open: its next statement takes a fresh client and sets the tenant again.
   */
  static async releaseCurrent(): Promise<void> {
    const store = TenantConnectionScope.storage.getStore();
    if (!store) return;
    if (store.pending) await store.pending.catch(() => undefined);
    // Mid-transaction the client IS the transaction: giving it back would commit nothing and run the
    // rest of the work on another connection that cannot see what was written (a tenant import inserts
    // parents, then children, inside one BEGIN). The host's wait on a guest then simply keeps the client.
    if (store.inTransaction) return;
    await TenantConnectionScope.release(store);
  }

  private static async open<T>(store: TenantScopeStore, fn: () => Promise<T>): Promise<T> {
    try {
      return await TenantConnectionScope.storage.run(store, fn);
    } finally {
      if (store.pending) await store.pending.catch(() => undefined);
      store.closed = true;
      await TenantConnectionScope.release(store);
    }
  }

  private static acquire(store: TenantScopeStore): Promise<PoolClient> {
    if (store.client) return Promise.resolve(store.client);
    if (store.pending) return store.pending;
    store.pending = (async () => {
      const client = await store.pool.connect();
      try {
        if (store.tenantId) await client.query(TenantRlsSql.setTenantStatement(), [store.tenantId]);
        if (store.platformAdmin) await client.query(TenantRlsSql.setPlatformAdminStatement(), ['on']);
      } catch (error) {
        client.release(error as Error);
        throw error;
      }
      store.client = client;
      return client;
    })();
    store.pending.finally(() => { store.pending = null; }).catch(() => undefined);
    return store.pending;
  }

  private static async release(store: TenantScopeStore): Promise<void> {
    const client = store.client;
    store.client = null;
    store.inTransaction = false;
    if (!client) return;
    try {
      await client.query(TenantRlsSql.resetTenantStatement());
      await client.query(TenantRlsSql.resetPlatformAdminStatement());
    } catch {
      // A client that cannot be cleared must never be reused carrying a stale tenant. Swallowing
      // here is deliberate: the release below is what matters, and pg discards a client whose
      // session is broken rather than returning a poisoned one to the pool.
    }
    client.release();
  }
}
