import { describe, expect, it } from 'vitest';
import { CertificateOwnerBackfillMigration } from '@core/database/migrations/051_certificate_owner_backfill';

/**
 * A certificate's owner decides WHOSE Cloudflare token its DNS-01 orders use. Rows created before
 * `setSource` stamped it are unowned, and unowned silently means the platform's token — for ever,
 * because nothing rewrites those rows.
 *
 * Seen in production: a site saved its own token, the order still went out under the platform's, and
 * the only clue was the "(tried the platform's Cloudflare token)" suffix on the failure.
 */
describe('CertificateOwnerBackfillMigration', () => {
  const tenants = [
    { id: 'shop', primary_host: 'shop.example.com', host_aliases: '["www.shop.example.com"]' },
    { id: 'hub', primary_host: 'hub.example.com', host_aliases: '[]' },
  ];

  /** A fake manager that records the updates the migration asks for. */
  class FakeDb {
    readonly updates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
    constructor(private readonly unowned: Array<Record<string, unknown>>) {}
    async queryRaw(sqlText: string): Promise<Array<Record<string, unknown>>> {
      return sqlText.includes('_system_tenants') ? tenants : this.unowned;
    }
    async update(_t: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<unknown> {
      this.updates.push({ where, data });
      return data;
    }
  }

  const run = async (hosts: string[]) => {
    const db = new FakeDb(hosts.map((host) => ({ host })));
    await new CertificateOwnerBackfillMigration().up(db as never);
    return db;
  };

  it('stamps a primary host with its site', async () => {
    const db = await run(['shop.example.com']);

    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].data).toEqual({ tenant_id: 'shop' });
    expect(db.updates[0].where.host).toBe('shop.example.com');
  });

  it('stamps an alias with the site that declares it', async () => {
    const db = await run(['www.shop.example.com']);

    expect(db.updates[0].data).toEqual({ tenant_id: 'shop' });
  });

  it('leaves a host no site claims alone', async () => {
    const db = await run(['example.com', 'console.example.com']);

    expect(db.updates).toHaveLength(0);
  });

  /** The filter must keep `tenant_id IS NULL`, so a concurrent stamp is never overwritten. */
  it('only ever updates rows that are still unowned', async () => {
    const db = await run(['shop.example.com']);

    expect(db.updates[0].where.tenant_id).toBeNull();
  });

  it('does nothing at all when every row already has an owner', async () => {
    const db = await run([]);

    expect(db.updates).toHaveLength(0);
  });

  it('matches regardless of case or trailing whitespace', async () => {
    const db = await run(['  SHOP.Example.COM  ']);

    expect(db.updates[0].data).toEqual({ tenant_id: 'shop' });
  });

  /** A missing table is a fresh install, not a failure — it must not take the boot down. */
  it('returns quietly when the tables do not exist yet', async () => {
    const db = {
      updates: [] as unknown[],
      queryRaw: async () => { throw new Error('relation "_system_certificates" does not exist'); },
      update: async () => undefined,
    };

    await expect(new CertificateOwnerBackfillMigration().up(db as never)).resolves.toBeUndefined();
  });

  it('survives a malformed aliases value and still uses the primary host', async () => {
    const fake = {
      updates: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
      async queryRaw(sqlText: string) {
        return sqlText.includes('_system_tenants')
          ? [{ id: 'shop', primary_host: 'shop.example.com', host_aliases: 'not json at all' }]
          : [{ host: 'shop.example.com' }];
      },
      async update(_t: string, where: Record<string, unknown>, data: Record<string, unknown>) {
        fake.updates.push({ where, data });
      },
    };
    await new CertificateOwnerBackfillMigration().up(fake as never);
    expect(fake.updates[0].data).toEqual({ tenant_id: 'shop' });
  });
});
