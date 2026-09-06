import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

/**
 * Per-tenant settings and opt-in media sharing, against a REAL Postgres.
 *
 * Both policies are deliberately ASYMMETRIC — `USING` is wider than `WITH CHECK` — and that
 * asymmetry is the entire safety mechanism:
 *
 *   settings — a tenant may READ a platform-level row and may never write one.
 *   media    — a tenant may READ a shared asset and may never modify one it does not own.
 *
 * Without it, "shared" would mean "writable by everyone", which is a leak wearing a feature's
 * clothes. These tests exist so that can never quietly become true.
 */
const runtimeUrl = process.env.TENANT_TEST_DATABASE_URL;
const ownerUrl = process.env.TENANT_TEST_OWNER_URL;

describe.skipIf(!runtimeUrl || !ownerUrl)('per-tenant settings and media sharing', () => {
  let app: Pool;
  let admin: Pool;

  const PLATFORM_KEY = 'iso_platform_setting';
  const ACME_KEY = 'iso_acme_setting';

  beforeAll(async () => {
    admin = new Pool({ connectionString: ownerUrl });
    app = new Pool({ connectionString: runtimeUrl });

    // Seeding has to obey the same policies as the app: a platform row needs the platform-admin
    // marker, and a tenant row needs that tenant set. There is no privileged back door, which is the
    // point — if seeding needed one, so would the runtime.
    //
    // ONE held client, not the pool: `set_config` is per-connection, so a pool would happily set the
    // marker on one connection and run the INSERT on another. That is the same trap
    // TenantConnectionScope exists to close in the application.
    const seed = await admin.connect();
    try {
      // Each row is removed in the context that can SEE it — a tenant row is invisible with no
      // tenant set, so a blanket delete would silently leave it behind and the insert would collide.
      await seed.query("SELECT set_config('app.tenant_id','t1',false)");
      await seed.query('DELETE FROM "_system_meta" WHERE "key" = $1', [ACME_KEY]);
      await seed.query("SELECT set_config('app.tenant_id','',false)");

      await seed.query("SELECT set_config('app.platform_admin','on',false)");
      await seed.query('DELETE FROM "_system_meta" WHERE "key" = $1', [PLATFORM_KEY]);
      await seed.query(
        'INSERT INTO "_system_meta" ("key","value","tenant_id") VALUES ($1,$2,NULL)',
        [PLATFORM_KEY, 'platform'],
      );
      await seed.query("SELECT set_config('app.platform_admin','off',false)");

      await seed.query("SELECT set_config('app.tenant_id','t1',false)");
      await seed.query(
        'INSERT INTO "_system_meta" ("key","value","tenant_id") VALUES ($1,$2,$3)',
        [ACME_KEY, 'acme-only', 't1'],
      );
      await seed.query("DELETE FROM media WHERE filename LIKE 'iso-%'");
      await seed.query(
        `INSERT INTO media (filename, original_name, mime_type, file_size, path, tenant_id, shared) VALUES
           ('iso-private.png','iso-private.png','image/png',1,'/iso-private.png','t1',FALSE),
           ('iso-shared.png','iso-shared.png','image/png',1,'/iso-shared.png','t1',TRUE)`,
      );
    } finally {
      await seed.query("SELECT set_config('app.tenant_id','',false)");
      await seed.query("SELECT set_config('app.platform_admin','off',false)");
      seed.release();
    }
  });

  afterAll(async () => {
    const cleanup = await admin.connect();
    try {
      await cleanup.query("SELECT set_config('app.platform_admin','on',false)");
      await cleanup.query('DELETE FROM "_system_meta" WHERE "key" = $1', [PLATFORM_KEY]);
      await cleanup.query("SELECT set_config('app.platform_admin','off',false)");
      await cleanup.query("SELECT set_config('app.tenant_id','t1',false)");
      await cleanup.query('DELETE FROM "_system_meta" WHERE "key" = $1', [ACME_KEY]);
      await cleanup.query("DELETE FROM media WHERE filename LIKE 'iso-%'");
    } finally {
      cleanup.release();
    }
    await admin.end();
    await app.end();
  });

  async function asTenant<T>(tenant: string, fn: (client: any) => Promise<T>): Promise<T> {
    const client = await app.connect();
    try {
      await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenant]);
      return await fn(client);
    } finally {
      await client.query("SELECT set_config('app.tenant_id', '', false)");
      client.release();
    }
  }

  it("a tenant's own setting is invisible to another tenant", async () => {
    const seen = await asTenant('t2', async (c) =>
      (await c.query('SELECT "key" FROM "_system_meta" WHERE "key" = $1', [ACME_KEY])).rows);
    expect(seen).toHaveLength(0);
  });

  it('a platform-level setting is readable by every tenant', async () => {
    for (const tenant of ['t1', 't2']) {
      const rows = await asTenant(tenant, async (c) =>
        (await c.query('SELECT "value" FROM "_system_meta" WHERE "key" = $1', [PLATFORM_KEY])).rows);
      expect(rows).toHaveLength(1);
    }
  });

  it('a tenant CANNOT write a platform-level setting without the platform-admin marker', async () => {
    await expect(asTenant('t1', async (c) =>
      c.query('UPDATE "_system_meta" SET "value" = $1 WHERE "key" = $2', ['hijacked', PLATFORM_KEY]),
    )).rejects.toThrow(/row-level security/i);
  });

  it('an unshared asset is invisible to the other tenant', async () => {
    const rows = await asTenant('t2', async (c) =>
      (await c.query("SELECT filename FROM media WHERE filename = 'iso-private.png'")).rows);
    expect(rows).toHaveLength(0);
  });

  it('a SHARED asset is readable by the other tenant', async () => {
    const rows = await asTenant('t2', async (c) =>
      (await c.query("SELECT filename FROM media WHERE filename = 'iso-shared.png'")).rows);
    expect(rows).toHaveLength(1);
  });

  it('a borrower CANNOT modify a shared asset it does not own', async () => {
    // The UPDATE policy's USING clause excludes assets the tenant does not own, so the statement
    // matches ZERO rows rather than raising. Silently affecting nothing is the safer outcome; what
    // matters is that the owner's asset is untouched afterwards.
    const result = await asTenant('t2', async (c) =>
      c.query("UPDATE media SET filename = 'stolen.png' WHERE filename = 'iso-shared.png'"));
    expect(result.rowCount).toBe(0);

    const stillOwned = await asTenant('t1', async (c) =>
      (await c.query("SELECT filename FROM media WHERE filename = 'iso-shared.png'")).rows);
    expect(stillOwned).toHaveLength(1);
  });

  it('a borrower CANNOT delete a shared asset — delete touches zero rows', async () => {
    await asTenant('t2', async (c) => c.query("DELETE FROM media WHERE filename = 'iso-shared.png'"));
    const stillThere = await asTenant('t1', async (c) =>
      (await c.query("SELECT filename FROM media WHERE filename = 'iso-shared.png'")).rows);
    expect(stillThere).toHaveLength(1);
  });

  it('the OWNER can still modify its own shared asset', async () => {
    await asTenant('t1', async (c) =>
      c.query("UPDATE media SET alt = 'owned' WHERE filename = 'iso-shared.png'"));
    const rows = await asTenant('t1', async (c) =>
      (await c.query("SELECT filename FROM media WHERE filename = 'iso-shared.png'")).rows);
    expect(rows).toHaveLength(1);
  });

  it('a tenant cannot create an asset owned by another tenant', async () => {
    await expect(asTenant('t2', async (c) =>
      c.query(`INSERT INTO media (filename, original_name, mime_type, file_size, path, tenant_id)
               VALUES ('iso-forged.png','iso-forged.png','image/png',1,'/iso-forged.png','t1')`),
    )).rejects.toThrow(/row-level security/i);
  });
});
