import { describe, expect, it } from 'vitest';
import { SitePreviewGrantService } from '@core/tenant/preview/site-preview-grant-service';
import { SitePreviewToken } from '@core/tenant/preview/site-preview-token';

/**
 * An in-memory stand-in for the raw system-table manager.
 *
 * IT MATCHES THE REAL DIALECT'S RAW PATH, INCLUDING WHERE THAT PATH IS SURPRISING. A `null` operand
 * in a WHERE there compiles to `= NULL`, which is true of NOTHING — it is not `IS NULL`. An earlier
 * version of this stub was kind about that, treated `null` as "is absent", and made the single-use
 * claim pass here while it matched zero rows against Postgres and refused every valid preview link.
 * A stub more forgiving than the thing it stands in for does not prevent failures; it hides them.
 */
class FakeDb {
  readonly rows: Array<Record<string, any>> = [];

  async insert(_table: string, row: Record<string, any>): Promise<void> {
    this.rows.push({ ...row });
  }

  async findOne(_table: string, where: Record<string, any>): Promise<Record<string, any> | null> {
    return this.rows.find((row) => FakeDb.matches(row, where)) ?? null;
  }

  async find(_table: string): Promise<Array<Record<string, any>>> {
    return [...this.rows];
  }

  async update(_table: string, where: Record<string, any>, patch: Record<string, any>): Promise<boolean> {
    const row = this.rows.find((candidate) => FakeDb.matches(candidate, where));
    if (!row) return false;
    Object.assign(row, patch);
    return true;
  }

  async delete(_table: string, where: Record<string, any>): Promise<void> {
    const index = this.rows.findIndex((row) => FakeDb.matches(row, where));
    if (index >= 0) this.rows.splice(index, 1);
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

    expect(await service.exchange(token, 'acme')).toBeTruthy();
    // The same link, followed twice. The second follow gets nothing at all.
    expect(await service.exchange(token, 'acme')).toBe('');
  });

  it('refuses a grant that has expired', async () => {
    const db = new FakeDb();
    const service = new SitePreviewGrantService(db);
    const token = await service.issue('acme', '7');
    db.rows[0].expires_at = new Date(Date.now() - 1);

    expect(await service.exchange(token, 'acme')).toBe('');
  });

  it('refuses a grant minted for another site', async () => {
    const db = new FakeDb();
    const service = new SitePreviewGrantService(db);
    const token = await service.issue('acme', '7');

    expect(await service.exchange(token, 'globex')).toBe('');
    // And refusing it did not spend it: the person it was minted for can still use it.
    expect(await service.exchange(token, 'acme')).toBeTruthy();
  });

  it('verifies a session only for the site it was exchanged on', async () => {
    const db = new FakeDb();
    const service = new SitePreviewGrantService(db);
    const session = await service.exchange(await service.issue('acme', '7'), 'acme');

    expect(await service.verifySession(session, 'acme')).not.toBeNull();
    expect(await service.verifySession(session, 'globex')).toBeNull();
    expect(await service.verifySession('', 'acme')).toBeNull();
    expect(await service.verifySession('not-a-session', 'acme')).toBeNull();
  });

  it('refuses a session that has run out', async () => {
    const db = new FakeDb();
    const service = new SitePreviewGrantService(db);
    const session = await service.exchange(await service.issue('acme', '7'), 'acme');
    db.rows[0].session_expires_at = new Date(Date.now() - 1);

    expect(await service.verifySession(session, 'acme')).toBeNull();
  });

  it('sweeps away what can no longer do anything, and keeps what can', async () => {
    const db = new FakeDb();
    const service = new SitePreviewGrantService(db);
    await service.exchange(await service.issue('acme', '7'), 'acme');
    const live = await service.issue('acme', '7');

    db.rows[0].session_expires_at = new Date(Date.now() - 1);
    expect(await service.prune()).toBe(1);
    expect(await service.exchange(live, 'acme')).toBeTruthy();
  });
});
