import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { TenantRlsSql } from '@fromcode119/database';

/**
 * The isolation proof, against a REAL Postgres.
 *
 * Every case here is an attack: a query that forgot its tenant filter, a write that forges another
 * tenant's id, a connection whose tenant was reset. Row-level security is what makes each one a
 * no-op instead of a cross-customer breach, and this suite is the evidence that it does.
 *
 * It SKIPS without the two connection URLs rather than passing vacuously — a green run with no
 * database would be worse than no test at all.
 */
const runtimeUrl = process.env.TENANT_TEST_DATABASE_URL;
const ownerUrl = process.env.TENANT_TEST_OWNER_URL;

describe.skipIf(!runtimeUrl || !ownerUrl)('tenant isolation (real Postgres)', () => {
  let app: Pool;
  let admin: Pool;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ownerUrl });
    app = new Pool({ connectionString: runtimeUrl });

    await admin.query('DROP TABLE IF EXISTS iso_orders');
    await admin.query('CREATE TABLE iso_orders (id serial PRIMARY KEY, total numeric)');
    for (const statement of TenantRlsSql.statementsFor('iso_orders')) await admin.query(statement);
    await admin.query('GRANT SELECT, INSERT, UPDATE, DELETE ON iso_orders TO fromcode_app');
    await admin.query('GRANT USAGE, SELECT ON SEQUENCE iso_orders_id_seq TO fromcode_app');

    for (const [tenant, total] of [['acme', 100], ['acme', 200], ['globex', 999]] as const) {
      await admin.query(TenantRlsSql.setTenantStatement(), [tenant]);
      await admin.query('INSERT INTO iso_orders (total) VALUES ($1)', [total]);
    }
    await admin.query(TenantRlsSql.resetTenantStatement());
  });

  afterAll(async () => {
    await admin.query('DROP TABLE IF EXISTS iso_orders');
    await admin.end();
    await app.end();
  });

  async function asTenant<T>(tenant: string, fn: (client: any) => Promise<T>): Promise<T> {
    const client = await app.connect();
    try {
      await client.query(TenantRlsSql.setTenantStatement(), [tenant]);
      return await fn(client);
    } finally {
      await client.query(TenantRlsSql.resetTenantStatement());
      client.release();
    }
  }

  it('an unfiltered SELECT returns only the calling tenant', async () => {
    const rows = await asTenant('acme', async (c) => (await c.query('SELECT * FROM iso_orders')).rows);
    expect(rows).toHaveLength(2);
    expect(rows.every((row: any) => row.tenant_id === 'acme')).toBe(true);
  });

  it('an unfiltered COUNT counts only the calling tenant', async () => {
    const total = await asTenant('globex', async (c) => (await c.query('SELECT count(*) FROM iso_orders')).rows[0].count);
    expect(Number(total)).toBe(1);
  });

  it('an explicit cross-tenant filter returns nothing', async () => {
    const rows = await asTenant('globex', async (c) =>
      (await c.query("SELECT * FROM iso_orders WHERE tenant_id = 'acme'")).rows);
    expect(rows).toHaveLength(0);
  });

  it('no tenant context returns nothing — fail closed, not fail open', async () => {
    const client = await app.connect();
    try {
      expect((await client.query('SELECT * FROM iso_orders')).rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it('a RESET tenant reads nothing and cannot insert (the empty-string trap)', async () => {
    const client = await app.connect();
    try {
      await client.query(TenantRlsSql.setTenantStatement(), ['acme']);
      await client.query(TenantRlsSql.resetTenantStatement());
      expect((await client.query('SELECT * FROM iso_orders')).rows).toHaveLength(0);
      await expect(client.query('INSERT INTO iso_orders (total) VALUES (1)'))
        .rejects.toThrow(/row-level security/i);
    } finally {
      client.release();
    }
  });

  it('an insert is stamped from the connection and needs no tenant_id', async () => {
    const row = await asTenant('acme', async (c) =>
      (await c.query('INSERT INTO iso_orders (total) VALUES (7) RETURNING tenant_id')).rows[0]);
    expect(row.tenant_id).toBe('acme');
  });

  it('cannot forge another tenant on insert', async () => {
    await expect(asTenant('globex', async (c) =>
      c.query("INSERT INTO iso_orders (tenant_id, total) VALUES ('acme', 1)"),
    )).rejects.toThrow(/row-level security/i);
  });

  it('cannot move a row to another tenant', async () => {
    await expect(asTenant('globex', async (c) =>
      c.query("UPDATE iso_orders SET tenant_id = 'acme'"),
    )).rejects.toThrow(/row-level security/i);
  });

  it('an unfiltered UPDATE touches only the calling tenant', async () => {
    await asTenant('globex', async (c) => c.query('UPDATE iso_orders SET total = 0'));
    const acmeTotals = await asTenant('acme', async (c) =>
      (await c.query('SELECT total FROM iso_orders ORDER BY id')).rows.map((row: any) => Number(row.total)));
    expect(acmeTotals.length).toBeGreaterThan(0);
    expect(acmeTotals.every((total: number) => total !== 0)).toBe(true);
  });

  it('an unfiltered DELETE deletes only the calling tenant', async () => {
    await asTenant('globex', async (c) => c.query('DELETE FROM iso_orders'));
    const globexLeft = await asTenant('globex', async (c) =>
      (await c.query('SELECT count(*) FROM iso_orders')).rows[0].count);
    const acmeLeft = await asTenant('acme', async (c) =>
      (await c.query('SELECT count(*) FROM iso_orders')).rows[0].count);
    expect(Number(globexLeft)).toBe(0);
    expect(Number(acmeLeft)).toBeGreaterThan(0);
  });

  it('concurrent interleaved tenants never observe each other', async () => {
    const [acmeSeen, globexSeen] = await Promise.all([
      asTenant('acme', async (c) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return (await c.query('SELECT DISTINCT tenant_id FROM iso_orders')).rows.map((row: any) => row.tenant_id);
      }),
      asTenant('globex', async (c) =>
        (await c.query('SELECT DISTINCT tenant_id FROM iso_orders')).rows.map((row: any) => row.tenant_id)),
    ]);
    expect(acmeSeen.every((tenant: string) => tenant === 'acme')).toBe(true);
    expect(globexSeen.every((tenant: string) => tenant === 'globex')).toBe(true);
  });

  it('the runtime role is neither superuser nor table owner', async () => {
    const row = (await app.query(`
      SELECT
        (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
        EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tableowner = current_user) AS owns_tables
    `)).rows[0];
    expect(row.is_superuser).toBe(false);
    expect(row.owns_tables).toBe(false);
  });
});
