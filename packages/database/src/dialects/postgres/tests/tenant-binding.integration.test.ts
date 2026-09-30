import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { Client, Pool } from 'pg';
import { PostgresTenantIsolation } from '@database/dialects/postgres/tenant/tenant-isolation';
import { PostgresTenantSession } from '@database/dialects/postgres/tenant/tenant-session';
import { TenantSettingsPolicySpec } from '@database/tenant/policies/tenant-settings-policy-spec';
import { PostgresDatabaseManager } from '@database/dialects/postgres/database-manager';

/**
 * Signed tenant bindings, against a REAL Postgres: SQL the application role runs cannot choose its site.
 *
 * Every case is an attack a plugin with `database:raw` — or an injection into one — could make. Before
 * the binding was signed, `set_config('app.tenant_id', '<another site>', false)` read that site's rows
 * (measured: 0 → 183 `people` rows of another site), and clearing it read the platform's own rows.
 *
 * SKIPS without the two connection URLs rather than passing vacuously (the same two the api's isolation
 * suite and CI use). Point them at a THROWAWAY database: the suite installs the verifier with its own key.
 */
// The SAME default as the api's isolation suite: both install the verifier into one CI database, and two
// keys would overwrite each other mid-run.
process.env.JWT_SECRET = 'tenant-isolation-integration-secret';

const runtimeUrl = process.env.TENANT_TEST_DATABASE_URL;
const ownerUrl = process.env.TENANT_TEST_OWNER_URL;

/** The signing contract restated independently of TenantBindingKey; drift fails "accepted once" below. */
const sign = (message: string): string => {
  const key = createHash('sha256').update(`fromcode.tenant-binding\u0000${process.env.JWT_SECRET}`).digest('hex');
  const inner = createHash('sha256').update(key + message, 'utf8').digest('hex');
  return createHash('sha256').update(key + inner, 'utf8').digest('hex');
};

describe.skipIf(!runtimeUrl || !ownerUrl)('signed tenant bindings (real Postgres)', () => {
  let app: Pool;
  let admin: Pool;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ownerUrl, max: 1 });
    app = new Pool({ connectionString: runtimeUrl });
    await admin.query('DROP TABLE IF EXISTS bind_orders, bind_settings');
    await admin.query('CREATE TABLE bind_orders (id serial PRIMARY KEY, total numeric)');
    await admin.query('CREATE TABLE bind_settings (key text, value text)');
    const isolation = new PostgresTenantIsolation((text, values) => admin.query(text, values as any[]).then((r: any) => r.rows));
    await isolation.isolateTable('bind_orders');
    await isolation.applyPolicy(new TenantSettingsPolicySpec('bind_settings'));
    await admin.query('GRANT SELECT, INSERT, UPDATE, DELETE ON bind_orders, bind_settings TO fromcode_app');
    await admin.query('GRANT USAGE, SELECT ON SEQUENCE bind_orders_id_seq TO fromcode_app');

    const owner = await admin.connect();
    try {
      for (const [tenant, total] of [['acme', 100], ['acme', 200], ['globex', 999]] as const) {
        await PostgresTenantSession.bind(owner, { tenantId: tenant });
        await owner.query('INSERT INTO bind_orders (total) VALUES ($1)', [total]);
      }
      await PostgresTenantSession.bind(owner, { platformAdmin: true });
      await owner.query("INSERT INTO bind_settings (key, value) VALUES ('smtp_password', 'platform-secret')");
    } finally {
      owner.release(true);
    }
  });

  afterAll(async () => {
    await admin.query('DROP TABLE IF EXISTS bind_orders, bind_settings');
    await admin.end();
    await app.end();
  });

  async function asTenant<T>(tenant: string, fn: (client: any) => Promise<T>): Promise<T> {
    const client = await app.connect();
    try {
      await PostgresTenantSession.bind(client, { tenantId: tenant });
      return await fn(client);
    } finally {
      await PostgresTenantSession.clear(client).catch(() => undefined);
      client.release();
    }
  }

  // ---- What the api does keeps working ----

  it('a bound connection reads and writes its own site only', async () => {
    const rows = await asTenant('acme', async (c) => (await c.query('SELECT tenant_id FROM bind_orders')).rows);
    expect(rows.map((r: any) => r.tenant_id)).toEqual(['acme', 'acme']);
    const stamped = await asTenant('globex', async (c) =>
      (await c.query('INSERT INTO bind_orders (total) VALUES (1) RETURNING tenant_id')).rows[0].tenant_id);
    expect(stamped).toBe('globex');
  });

  it('rebinding the same connection again and again keeps working', async () => {
    const client = await app.connect();
    try {
      for (const tenant of ['acme', 'globex', 'acme', 'globex']) {
        await PostgresTenantSession.bind(client, { tenantId: tenant });
        const seen = (await client.query('SELECT DISTINCT tenant_id FROM bind_orders')).rows.map((r: any) => r.tenant_id);
        expect(seen).toEqual([tenant]);
      }
    } finally {
      await PostgresTenantSession.clear(client);
      client.release();
    }
  });

  it('a connection cleared to "none" reads the platform\'s rows and no site\'s', async () => {
    const client = await app.connect();
    try {
      await PostgresTenantSession.clear(client);
      expect((await client.query('SELECT key FROM bind_settings')).rows.map((r: any) => r.key)).toEqual(['smtp_password']);
      expect((await client.query('SELECT * FROM bind_orders')).rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it('a connection that never bound sees nothing — not a site, not the platform', async () => {
    // A NEW physical connection, not one the pool may hand back already bound by an earlier case.
    const client = new Client({ connectionString: runtimeUrl });
    await client.connect();
    try {
      expect((await client.query('SELECT * FROM bind_orders')).rows).toHaveLength(0);
      expect((await client.query('SELECT * FROM bind_settings')).rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  it('boot order: prepared first, every NEW pooled connection opens already bound — request pool as none, DDL pool as platform', async () => {
    const ddl = new PostgresDatabaseManager(ownerUrl as string);
    ddl.markAsPlatformConnection();
    await ddl.prepareTenantBinding();
    const runtime = new PostgresDatabaseManager(runtimeUrl as string);
    try {
      // Untenanted reads through the manager's own pool: the resting `none` binding reads platform rows.
      const keys = ((await runtime.queryRaw('SELECT key FROM bind_settings')) as any[]).map((row) => row.key);
      expect(keys).toContain('smtp_password');
      // The DDL pool rests as the platform: a platform row may be written with no scope at all.
      await ddl.queryRaw("INSERT INTO bind_settings (key, value) VALUES ('boot_marker', 'ok')");
      const written = ((await runtime.queryRaw("SELECT value FROM bind_settings WHERE key = 'boot_marker'")) as any[]);
      expect(written.map((row) => row.value)).toEqual(['ok']);
    } finally {
      await ddl.queryRaw("DELETE FROM bind_settings WHERE key = 'boot_marker'").catch(() => undefined);
      await (ddl as any).pool.end();
      await (runtime as any).pool.end();
    }
  });

  // ---- Attacks ----

  it('SQL that names another site for itself reads nothing', async () => {
    const rows = await asTenant('globex', async (c) => {
      await c.query("SELECT set_config('app.tenant_id', 'acme', false)");
      return (await c.query('SELECT * FROM bind_orders')).rows;
    });
    expect(rows.every((r: any) => r.tenant_id === 'globex')).toBe(true);
  });

  it('SQL that names another site cannot write into it', async () => {
    await expect(asTenant('globex', async (c) =>
      c.query("INSERT INTO bind_orders (tenant_id, total) VALUES ('acme', 5)"))).rejects.toThrow(/row-level security/i);
  });

  it('SQL that CLEARS the site does not reach the platform\'s rows', async () => {
    const rows = await asTenant('acme', async (c) => {
      await c.query("SELECT set_config('app.tenant_id', '', false)");
      return (await c.query('SELECT * FROM bind_settings')).rows;
    });
    expect(rows).toHaveLength(0);
  });

  it('SQL that claims the platform cannot write a platform row', async () => {
    await expect(asTenant('acme', async (c) => {
      await c.query("SELECT set_config('app.tenant_id', '', false), set_config('app.platform_admin', 'on', false)");
      return c.query("INSERT INTO bind_settings (key, value) VALUES ('smtp_password', 'hijacked')");
    })).rejects.toThrow(/row-level security/i);
  });

  it('a genuine signed bind, captured and sent again, is refused', async () => {
    const client = await app.connect();
    const sent: Array<{ text: string; values?: unknown[] }> = [];
    const query = client.query.bind(client);
    (client as any).query = (text: any, values?: any) => {
      if (typeof text === 'string' && text.includes('fc_bind(')) sent.push({ text, values });
      return query(text, values);
    };
    try {
      await PostgresTenantSession.clear(client); // opens the connection ('none')
      await PostgresTenantSession.bind(client, { tenantId: 'acme' });
      await PostgresTenantSession.bind(client, { tenantId: 'globex' });
      const captured = sent.find((call) => call.values?.[0] === 'tenant:acme');
      expect(captured).toBeTruthy();
      // The attacker, now on globex, replays the exact statement that bound this connection to acme.
      await expect(query(captured!.text, captured!.values as any[])).rejects.toThrow(/bind refused/);
      expect((await query('SELECT DISTINCT tenant_id FROM bind_orders')).rows.map((r: any) => r.tenant_id)).toEqual(['globex']);
    } finally {
      (client as any).query = query;
      client.release(true);
    }
  });

  it('the connection\'s own binding table is not readable by the runtime role', async () => {
    await expect(asTenant('acme', async (c) => c.query('SELECT * FROM pg_temp.fc_tenant_binding')))
      .rejects.toThrow(/permission denied/i);
  });

  it('a live connection cannot be re-opened into another binding', async () => {
    await expect(asTenant('acme', async (c) => {
      const pid = (await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      return c.query('SELECT fc_binding_open($1, $2)', ['platform', sign(`platform:${pid}`)]);
    })).rejects.toThrow(/already open/);
  });

  it('dropping its own binding leaves a connection with nothing', async () => {
    const client = await app.connect();
    try {
      await PostgresTenantSession.bind(client, { tenantId: 'acme' });
      await client.query('DISCARD TEMP').catch(() => undefined);
      await client.query('DROP TABLE IF EXISTS pg_temp.fc_tenant_binding').catch(() => undefined);
      await client.query('CREATE TEMP TABLE fc_tenant_binding (nonce text, counter int, bound text)').catch(() => undefined);
      await client.query("INSERT INTO pg_temp.fc_tenant_binding VALUES ('x', 0, 'platform')").catch(() => undefined);
      expect((await client.query('SELECT * FROM bind_orders')).rows).toHaveLength(0);
      expect((await client.query('SELECT * FROM bind_settings')).rows).toHaveLength(0);
    } finally {
      client.release(true);
    }
  });

  it('the runtime role cannot read the key', async () => {
    await expect(app.query('SELECT key FROM _system_tenant_binding_key')).rejects.toThrow(/permission denied/i);
  });
});
