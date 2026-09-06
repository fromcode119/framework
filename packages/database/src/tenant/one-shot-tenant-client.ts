import type { PoolClient } from 'pg';
import { TenantRlsSql } from '@database/tenant/tenant-rls-sql';
import type { TenantScopeStore } from '@database/tenant/tenant-scope-store';

/**
 * The client a CLOSED scope hands to a late statement.
 *
 * A request's scope closes when its response finishes or its socket goes away, but the handler may
 * still be running: an audit row written after `res.json`, a storefront request the frontend gave
 * up on at its own deadline. Before this class, such a statement re-acquired a pooled client into
 * the closed store — a store nothing would ever release again. Nine aborted storefront requests plus
 * one trailing settings write emptied a pool of ten, and every request after them waited forever.
 *
 * Each statement here takes a client, sets the scope's tenant (or platform marker) on it, runs, clears
 * it and gives it straight back. Nothing is cached, so nothing can be orphaned, and the statement still
 * runs under the policy of the scope it belongs to rather than unisolated.
 */
export class OneShotTenantClient {
  constructor(private readonly store: TenantScopeStore) {}

  async query(...args: unknown[]): Promise<any> {
    const client: PoolClient = await this.store.pool.connect();
    try {
      if (this.store.tenantId) await client.query(TenantRlsSql.setTenantStatement(), [this.store.tenantId]);
      if (this.store.platformAdmin) await client.query(TenantRlsSql.setPlatformAdminStatement(), ['on']);
      return await (client.query as (...params: unknown[]) => Promise<any>)(...args);
    } finally {
      try {
        await client.query(TenantRlsSql.resetTenantStatement());
        await client.query(TenantRlsSql.resetPlatformAdminStatement());
      } catch {
        // Same rule as TenantConnectionScope.release: the release below is what matters, and pg
        // discards a client whose session is broken rather than returning a poisoned one.
      }
      client.release();
    }
  }
}
