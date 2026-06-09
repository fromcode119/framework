import { describe, expect, it, vi } from 'vitest';
import { PersonCatalogService } from '../person-catalog-service';

function makeDb(existing: any[] = []) {
  const rows = [...existing];
  return {
    rows,
    find: vi.fn(async (_table: string, opts?: any) => {
      const where = opts?.where ?? {};
      return rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
    }),
    findOne: vi.fn(async (_table: string, where: any) =>
      rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null),
    insert: vi.fn(async (_table: string, data: any) => { rows.push({ id: rows.length + 1, ...data }); return data; }),
    update: vi.fn(async () => ({}))
  };
}

describe('PersonCatalogService', () => {
  it('register() inserts a new catalog entry when kind+key is unused', async () => {
    const db = makeDb();
    const svc = new PersonCatalogService(db as any);

    await svc.register('source', { key: 'affiliate', label: 'people.source.affiliate', pluginSlug: 'mlm' });

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledWith('person_catalogs', expect.objectContaining({
      kind: 'source', key: 'affiliate', label: 'people.source.affiliate', pluginSlug: 'mlm'
    }));
  });

  it('register() is idempotent — does not insert a duplicate kind+key', async () => {
    const db = makeDb([{ id: 1, kind: 'source', key: 'affiliate', label: 'x', pluginSlug: 'mlm' }]);
    const svc = new PersonCatalogService(db as any);

    await svc.register('source', { key: 'affiliate', label: 'people.source.affiliate' });

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('list() returns entries for a kind', async () => {
    const db = makeDb([
      { id: 1, kind: 'status', key: 'active', label: 'a' },
      { id: 2, kind: 'source', key: 'self', label: 's' }
    ]);
    const svc = new PersonCatalogService(db as any);

    const result = await svc.list('status');

    expect(result).toEqual([{ key: 'active', label: 'a' }]);
  });

  it('seedDefaults() registers the framework default status and source values', async () => {
    const db = makeDb();
    const svc = new PersonCatalogService(db as any);

    await svc.seedDefaults();

    const seeded = db.insert.mock.calls.map((c) => `${c[1].kind}:${c[1].key}`);
    expect(seeded).toEqual(expect.arrayContaining([
      'status:active', 'status:inactive', 'status:archived',
      'source:self', 'source:contact'
    ]));
  });
});
