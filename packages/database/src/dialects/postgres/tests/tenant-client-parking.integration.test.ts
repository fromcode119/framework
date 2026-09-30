import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PostgresTenantIsolation } from '@database/dialects/postgres/tenant/tenant-isolation';
import { PostgresTenantSession } from '@database/dialects/postgres/tenant/tenant-session';
import { TenantBindingKey } from '@database/dialects/postgres/tenant/tenant-binding-key';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';
import { TenantClientParking } from '@database/tenant/tenant-client-parking';

/**
 * A parked client, against a REAL Postgres: reusing one bound connection across an invocation's calls
 * must keep every site's rows its own, and must not starve a small pool.
 *
 * SKIPS without the two connection URLs (the same two the binding suite and CI use). Point them at a
 * THROWAWAY database.
 */

const runtimeUrl = process.env.TENANT_TEST_DATABASE_URL;
const ownerUrl = process.env.TENANT_TEST_OWNER_URL;

describe.skipIf(!runtimeUrl || !ownerUrl)('TenantClientParking (real Postgres)', () => {
  let admin: Pool;
  let app: Pool;

  const sitesSeen = async (pool: Pool): Promise<string[]> => {
    const rows = await TenantConnectionScope.currentClient(pool)!.query('SELECT DISTINCT tenant_id FROM park_orders ORDER BY 1');
    return rows.rows.map((row: any) => row.tenant_id);
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ownerUrl, max: 1 });
    // Two connections for twelve concurrent invocations: a parking that held clients through a wait
    // would stall here until the test timed out.
    app = new Pool({ connectionString: runtimeUrl, max: 2 });
    await admin.query('DROP TABLE IF EXISTS park_orders');
    await admin.query('CREATE TABLE park_orders (id serial PRIMARY KEY, total numeric)');
    await new PostgresTenantIsolation((text, values) => admin.query(text, values as any[]).then((r: any) => r.rows)).isolateTable('park_orders');
    TenantBindingKey.use((await admin.query('SELECT key FROM _system_tenant_binding_key WHERE id = 1')).rows[0].key);
    await admin.query('GRANT SELECT, INSERT, UPDATE, DELETE ON park_orders TO fromcode_app');
    const owner = await admin.connect();
    try {
      for (const tenant of ['acme', 'globex']) {
        await PostgresTenantSession.bind(owner, { tenantId: tenant });
        await owner.query('INSERT INTO park_orders (total) VALUES (1)');
      }
    } finally {
      owner.release(true);
    }
  });

  afterAll(async () => {
    await admin.query('DROP TABLE IF EXISTS park_orders');
    await admin.end();
    await app.end();
  });

  it('interleaved invocations of two sites each see only their own rows, run after run', async () => {
    const acme = new TenantClientParking(app, 'acme');
    const globex = new TenantClientParking(app, 'globex');
    try {
      for (let i = 0; i < 10; i += 1) {
        expect(await acme.run(() => sitesSeen(app))).toEqual(['acme']);
        expect(await globex.run(() => sitesSeen(app))).toEqual(['globex']);
      }
    } finally {
      await Promise.all([acme.close(), globex.close()]);
    }
  });

  it('a pool of two serves twelve concurrent invocations to completion, each on its own site', async () => {
    const invocations = Array.from({ length: 12 }, (_, i) => (async () => {
      const site = i % 2 ? 'acme' : 'globex';
      const parking = new TenantClientParking(app, site);
      try {
        const seen: string[][] = [];
        for (let call = 0; call < 5; call += 1) {
          seen.push(await parking.run(() => sitesSeen(app)));
          // The guest's own work between two calls.
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        return { site, seen };
      } finally {
        await parking.close();
      }
    })());
    const results = await Promise.all(invocations);
    for (const { site, seen } of results) expect(seen).toEqual(Array(5).fill([site]));
  }, 20_000);

  it('back-to-back runs of one invocation reuse the same bound connection', async () => {
    const parking = new TenantClientParking(app, 'acme');
    const pid = () => TenantConnectionScope.currentClient(app)!.query('SELECT pg_backend_pid() AS pid').then((r: any) => r.rows[0].pid);
    try {
      const pids: number[] = [];
      for (let i = 0; i < 5; i += 1) pids.push(await parking.run(pid));
      expect(new Set(pids).size).toBe(1);
    } finally {
      await parking.close();
    }
  });

  it('a closed parking leaves no site bound on the connections it gave back', async () => {
    const parking = new TenantClientParking(app, 'acme');
    await parking.run(() => sitesSeen(app));
    await parking.close();
    const clients = await Promise.all([app.connect(), app.connect()]);
    try {
      for (const client of clients) expect((await client.query('SELECT * FROM park_orders')).rows).toHaveLength(0);
    } finally {
      for (const client of clients) client.release();
    }
  });
});
