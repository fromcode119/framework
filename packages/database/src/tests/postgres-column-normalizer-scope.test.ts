import { describe, expect, it } from 'vitest';
import { PostgresColumnNormalizer } from '@database/dialects/postgres/column-normalizer';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';

class FakeClient {
  readonly calls: string[] = [];
  released = false;
  async query(text: string) {
    this.calls.push(text.replace(/\s+/g, ' ').trim());
    return { rows: text.includes('information_schema.columns') ? [{ column_name: 'payload', data_type: 'jsonb' }] : [] };
  }
  release() { this.released = true; }
}

/** Counts every client handed out: a second `connect` inside one scope is the deadlock in the making. */
class FakePool {
  readonly clients: FakeClient[] = [];
  async connect() { const c = new FakeClient(); this.clients.push(c); return c as any; }
  async query(text: string) { const c = await this.connect(); const r = await c.query(text); c.release(); return r; }
}

describe('PostgresColumnNormalizer inside a tenant scope', () => {
  it('reads column metadata on the scope\'s own client, never a second pooled one', async () => {
    const pool = new FakePool();
    const normalizer = new PostgresColumnNormalizer(pool as any);
    await TenantConnectionScope.run(pool as any, 't1', async () => {
      await TenantConnectionScope.currentClient()!.query('select 1');
      const where = await normalizer.normalizeWhereForTable('fcp_ecommerce_inventory', { payload: { a: 1 } });
      expect(where.payload).toBe('{"a":1}');
    });
    expect(pool.clients).toHaveLength(1);
    expect(pool.clients[0].calls.some((c) => c.includes('information_schema.columns'))).toBe(true);
  });

  it('uses the pool when no scope is open', async () => {
    const pool = new FakePool();
    await new PostgresColumnNormalizer(pool as any).normalizeWhereForTable('t', { payload: 1 });
    expect(pool.clients).toHaveLength(1);
    expect(pool.clients[0].released).toBe(true);
  });
});
