import { describe, expect, it } from 'vitest';
import { SitePreviewGrantService } from '@core/tenant/preview/site-preview-grant-service';
import { SitePreviewToken } from '@core/tenant/preview/site-preview-token';

/**
 * An in-memory stand-in for the raw system-table manager.
 *
 * IT MATCHES THE REAL DIALECT'S RAW PATH, INCLUDING WHERE THAT PATH IS SURPRISING. Two ways, both
 * learned from a failure this stub had been too kind to reproduce:
 *
 *   A `null` operand in a WHERE compiles to `= NULL`, which is true of NOTHING — it is not
 *   `IS NULL`. An earlier version treated `null` as "is absent", and made the single-use claim pass
 *   here while it matched zero rows against Postgres and refused every valid preview link.
 *
 *   ROW-LEVEL SECURITY IS ENFORCED AGAINST THE CONNECTION, not against the values. The table's
 *   policy is `tenant_id = nullif(current_setting('app.tenant_id'), '')`, so a row that NAMES its
 *   site is still refused when the connection is bound to no site — which is every request made from
 *   the platform scope. That shipped: minting a preview link failed on every site, while this suite
 *   stayed green because the stub wrote whatever it was handed.
 *
 * A stub more forgiving than the thing it stands in for does not prevent failures; it hides them.
 */
class FakeDb {
  readonly rows: Array<Record<string, any>> = [];

  /** The tenant this connection is bound to. Only `withTenant` sets it — unbound is the platform. */
  private bound: string | null = null;

  async withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    const outer = this.bound;
    this.bound = tenantId;
    try { return await fn(); } finally { this.bound = outer; }
  }

  async insert(_table: string, row: Record<string, any>): Promise<void> {
    if (row.tenant_id !== this.bound) {
      throw new Error('new row violates row-level security policy for table "_system_site_preview_grants"');
    }
    this.rows.push({ ...row });
  }

  async findOne(_table: string, where: Record<string, any>): Promise<Record<string, any> | null> {
    return this.visible().find((row) => FakeDb.matches(row, where)) ?? null;
  }

  async find(_table: string): Promise<Array<Record<string, any>>> {
    return this.visible();
  }

  async update(_table: string, where: Record<string, any>, patch: Record<string, any>): Promise<boolean> {
    const row = this.visible().find((candidate) => FakeDb.matches(candidate, where));
    if (!row) return false;
    Object.assign(row, patch);
    return true;
  }

  async delete(_table: string, where: Record<string, any>): Promise<void> {
    const doomed = this.visible().find((row) => FakeDb.matches(row, where));
    const index = doomed ? this.rows.indexOf(doomed) : -1;
    if (index >= 0) this.rows.splice(index, 1);
  }

  /** What the policy lets THIS connection see: its own site's rows, and nothing when it has none. */
  private visible(): Array<Record<string, any>> {
    return this.rows.filter((row) => row.tenant_id === this.bound);
  }

  private static matches(row: Record<string, any>, where: Record<string, any>): boolean {
    // `= NULL` is true of nothing — see the class comment.
    return Object.entries(where).every(([key, value]) => value !== null && value !== undefined && row[key] === value);
  }
}

describe('SitePreviewGrantService', () => {
  it('stores only a hash — the raw grant is never recoverable from the table', async () => {
    const db = new FakeDb();
    const token = await new SitePreviewGrantService(db).issue('acme', '7');

    expect(token).toBeTruthy();
    expect(JSON.stringify(db.rows)).not.toContain(token);
    expect(db.rows[0].token_hash).toBe(SitePreviewToken.hash(token));
  });

  it('spends a grant exactly once', async () => {
    const db = new FakeDb();
    const service = new SitePreviewGrantService(db);
    const token = await service.issue('acme', '7');

    // Bound to the site, the way the storefront request that follows the link is bound.
    await db.withTenant('acme', async () => {
      expect(await service.exchange(token, 'acme')).toBeTruthy();
      // The same link, followed twice. The second follow gets nothing at all.
      expect(await service.exchange(token, 'acme')).toBe('');
    });
  });

  it('refuses a grant that has expired', async () => {
    const db = new FakeDb();
    const service = new SitePreviewGrantService(db);
    const token = await service.issue('acme', '7');
    db.rows[0].expires_at = new Date(Date.now() - 1);

    await db.withTenant('acme', async () => {
      expect(await service.exchange(token, 'acme')).toBe('');
    });
  });

  it('refuses a grant minted for another site', async () => {
    const db = new FakeDb();
    const service = new SitePreviewGrantService(db);
    const token = await service.issue('acme', '7');

    // Asked about the WRONG site from a connection that can see the row. Row-level security would
    // already hide it from globex's own request; this proves the class refuses it regardless, which
    // is what stops a caller passing a tenant it did not derive from the host.
    await db.withTenant('acme', async () => {
      expect(await service.exchange(token, 'globex')).toBe('');
      // And refusing it did not spend it: the person it was minted for can still use it.
      expect(await service.exchange(token, 'acme')).toBeTruthy();
    });
  });

  it('verifies a session only for the site it was exchanged on', async () => {
    const db = new FakeDb();
    const service = new SitePreviewGrantService(db);
    const token = await service.issue('acme', '7');
    const session = await db.withTenant('acme', () => service.exchange(token, 'acme'));

    await db.withTenant('acme', async () => {
      expect(await service.verifySession(session, 'acme')).not.toBeNull();
      expect(await service.verifySession(session, 'globex')).toBeNull();
      expect(await service.verifySession('', 'acme')).toBeNull();
      expect(await service.verifySession('not-a-session', 'acme')).toBeNull();
    });
  });

  it('refuses a session that has run out', async () => {
    const db = new FakeDb();
    const service = new SitePreviewGrantService(db);
    const token = await service.issue('acme', '7');
    const session = await db.withTenant('acme', () => service.exchange(token, 'acme'));
    db.rows[0].session_expires_at = new Date(Date.now() - 1);

    await db.withTenant('acme', async () => {
      expect(await service.verifySession(session, 'acme')).toBeNull();
    });
  });

  it('sweeps away what can no longer do anything, and keeps what can', async () => {
    const db = new FakeDb();
    const service = new SitePreviewGrantService(db);
    const spent = await service.issue('acme', '7');
    await db.withTenant('acme', () => service.exchange(spent, 'acme'));
    const live = await service.issue('acme', '7');

    db.rows[0].session_expires_at = new Date(Date.now() - 1);
    // The sweep reads and deletes tenant-owned rows, so it only ever sees a site while bound to it —
    // which is why the timer that calls it runs once PER TENANT. Unbound it finds nothing to sweep.
    expect(await service.prune()).toBe(0);
    await db.withTenant('acme', async () => {
      expect(await service.prune()).toBe(1);
      expect(await service.exchange(live, 'acme')).toBeTruthy();
    });
  });
});
