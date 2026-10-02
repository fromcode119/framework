import { describe, expect, it } from 'vitest';
import { PostgresReadOperations } from '@database/dialects/postgres/read-operations';
import { PostgresColumnNormalizer } from '@database/dialects/postgres/column-normalizer';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';
import { TenantBindingKey } from '@database/dialects/postgres/tenant/tenant-binding-key';

TenantBindingKey.use('test-key');

/**
 * `findAsJson` remembers each table's columns. When another process drops or renames one, the JSON
 * statement fails before its signature can be compared; it must forget the shape and hand back null
 * (the caller runs `find`) instead of failing every later read. Inside a transaction it is not tried
 * at all: a failed statement there would abort the caller's work.
 */
class FakePostgres {
  columns = [{ name: 'id', type: 23, kind: 'b' }, { name: 'gone_soon', type: 25, kind: 'b' }];
  readonly statements: string[] = [];

  signature(): string {
    return this.columns.map((c) => `${c.name}:${c.type}`).join(',');
  }

  async query(input: any, values?: unknown[]) {
    const text = String(input?.text ?? input);
    this.statements.push(text);
    if (text.includes('information_schema.tables')) return { rows: [{ total: 1 }] };
    if (text.includes('OVER (ORDER BY a.attnum')) return { rows: this.columns.map((c) => ({ ...c, signature: this.signature() })) };
    if (text.includes('row_to_json')) {
      const missing = ['gone_soon'].find((name) => text.includes(`r."${name}"`) && !this.columns.some((c) => c.name === name));
      if (missing) throw Object.assign(new Error(`column r.${missing} does not exist`), { code: '42703' });
      return { rows: [[JSON.stringify({ id: 1 }), this.signature()]] };
    }
    return { rows: [], values };
  }
}

class FakePool {
  constructor(private readonly db: FakePostgres) {}
  async connect() { return { query: (text: any, values?: unknown[]) => this.db.query(text, values), release() {} } as any; }
  query(text: any, values?: unknown[]) { return this.db.query(text, values); }
}

function reader(db: FakePostgres) {
  const pool = new FakePool(db) as any;
  return { pool, reads: new PostgresReadOperations(pool, new PostgresColumnNormalizer(pool), null) };
}

describe('PostgresReadOperations.findAsJson', () => {
  it('answers with the rows as JSON while the remembered columns are current', async () => {
    const { reads } = reader(new FakePostgres());
    expect(await reads.findAsJson('fcp_alpha_items', {})).toEqual({ text: '[{"id":1}]', revive: {} });
  });

  it('a column dropped elsewhere makes it step aside, then read the new columns — never fail every read', async () => {
    const db = new FakePostgres();
    const { reads } = reader(db);
    await reads.findAsJson('fcp_alpha_items', {});
    db.columns = db.columns.filter((c) => c.name !== 'gone_soon');
    expect(await reads.findAsJson('fcp_alpha_items', {})).toBeNull();
    expect(await reads.findAsJson('fcp_alpha_items', {})).toEqual({ text: '[{"id":1}]', revive: {} });
  });

  it('a column added elsewhere is caught by the signature and the shape read again', async () => {
    const db = new FakePostgres();
    const { reads } = reader(db);
    await reads.findAsJson('fcp_alpha_items', {});
    db.columns = [...db.columns, { name: 'added', type: 25, kind: 'b' }];
    expect(await reads.findAsJson('fcp_alpha_items', {})).toBeNull();
    expect(await reads.findAsJson('fcp_alpha_items', {})).not.toBeNull();
  });

  it('is not tried inside a transaction', async () => {
    const db = new FakePostgres();
    const { pool, reads } = reader(db);
    await TenantConnectionScope.run(pool, 't1', async () => {
      await TenantConnectionScope.currentClient(pool)!.query('BEGIN');
      expect(TenantConnectionScope.inTransaction(pool)).toBe(true);
      expect(await reads.findAsJson('fcp_alpha_items', {})).toBeNull();
      await TenantConnectionScope.currentClient(pool)!.query('COMMIT');
      expect(TenantConnectionScope.inTransaction(pool)).toBe(false);
    });
    expect(db.statements.some((text) => text.includes('row_to_json'))).toBe(false);
  });
});
