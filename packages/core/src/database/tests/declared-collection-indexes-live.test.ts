import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AggregateFunction, DatabaseFactory, SortDirection } from '@fromcode119/database';
import type { IDatabaseManager } from '@fromcode119/database';
import { DeclaredIndexEnsurer } from '@core/database/declared-index-ensurer';
import { EntitySchemaPlanService } from '@core/database/entity-schema-plan-service';
import { SchemaManager } from '@core/database/schema-manager';
import { TenantMode } from '@core/tenant/tenant-mode';
import type { ICollection } from '@core/collections/interfaces/collection.interface';

/**
 * Declared indexes against a real Postgres, FORCE row-level security included.
 *
 * Unit tests prove the calls; only a server proves the index is the shape claimed, that two sites may
 * hold one key while one site may not, that a unique over duplicates is skipped without touching a row,
 * and that the duplicate groups can be read through isolation. SKIPPED unless `POSTGRES_TEST_URL` names
 * a throwaway database whose role OWNS it and is NOT a superuser (a superuser bypasses row-level
 * security, which would make the isolation cases vacuous).
 */
const url = process.env.POSTGRES_TEST_URL || '';
const PROGRESS = 'fcp_idxlive_progress';
const VISITS = 'fcp_idxlive_visits';
const DUPES = 'fcp_idxlive_dupes';
const TABLES = [PROGRESS, VISITS, DUPES];

const progress: ICollection = {
  slug: PROGRESS,
  fields: [
    { name: 'userId', type: 'number' },
    { name: 'lessonId', type: 'number' },
    { name: 'status', type: 'text' },
    { name: 'score', type: 'number' },
  ] as any,
  indexes: [
    { fields: ['userId', 'lessonId'], unique: true },
    { name: 'fcp_idxlive_progress_status_score', fields: ['status', 'score'] },
  ],
};

const visits: ICollection = {
  slug: VISITS,
  fields: [{ name: 'visitorHash', type: 'text' }, { name: 'endedAt', type: 'text' }] as any,
  indexes: [{ fields: ['visitorHash'], unique: true, where: { endedAt: null } }],
};

let db: IDatabaseManager | null = null;

const indexDef = async (name: string): Promise<string> => {
  const rows = await db!.queryRaw('SELECT indexdef FROM pg_indexes WHERE indexname = $1', [name]);
  return String(rows[0]?.indexdef ?? '');
};
const insertAsOwner = async (table: string, rows: string) => {
  await db!.queryRaw(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`);
  try { await db!.queryRaw(rows); } finally { await db!.queryRaw(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`); }
};
const countAsOwner = async (table: string): Promise<number> => {
  await db!.queryRaw(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`);
  try { return Number((await db!.queryRaw(`SELECT count(*)::int AS n FROM "${table}"`))[0].n); }
  finally { await db!.queryRaw(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`); }
};

beforeAll(async () => {
  if (!url) return;
  try {
    db = DatabaseFactory.create(url);
    await db.connect();
    await db.queryRaw('SELECT 1');
  } catch {
    db = null;
    return;
  }
  for (const table of TABLES) await db.queryRaw(`DROP TABLE IF EXISTS "${table}" CASCADE`);
  TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
});

afterAll(async () => {
  TenantMode.reset();
  if (!db) return;
  for (const table of TABLES) await db.queryRaw(`DROP TABLE IF EXISTS "${table}" CASCADE`);
});

describe('declared collection indexes (live Postgres)', () => {
  it('creates a composite unique index tenant-led, plus a composite plain index, and a second sync changes nothing', async (ctx) => {
    if (!db) return ctx.skip();
    const manager = new SchemaManager(db);
    await manager.syncCollection(progress);

    const unique = await indexDef('fcp_idxlive_progress_user_id_lesson_id_idx');
    expect(unique).toContain('CREATE UNIQUE INDEX');
    expect(unique).toContain('(tenant_id, user_id, lesson_id)');
    expect(await indexDef('fcp_idxlive_progress_status_score')).toContain('(status, score)');
    expect(await indexDef('fcp_idxlive_progress_status_score')).not.toContain('UNIQUE');

    await manager.syncCollection(progress);
    expect(await indexDef('fcp_idxlive_progress_user_id_lesson_id_idx')).toBe(unique);
  });

  it('holds the same key for two sites and refuses it twice inside one site', async (ctx) => {
    if (!db) return ctx.skip();
    await insertAsOwner(PROGRESS, `INSERT INTO "${PROGRESS}" (tenant_id, user_id, lesson_id, status, score) VALUES ('site-a', 1, 1, 'done', 5), ('site-b', 1, 1, 'done', 7), ('site-a', 1, 2, 'open', 0)`);
    await db.queryRaw(`ALTER TABLE "${PROGRESS}" NO FORCE ROW LEVEL SECURITY`);
    try {
      await expect(db.queryRaw(`INSERT INTO "${PROGRESS}" (tenant_id, user_id, lesson_id) VALUES ('site-a', 1, 1)`)).rejects.toThrow(/duplicate key|unique/i);
      await expect(db.queryRaw(`INSERT INTO "${PROGRESS}" (tenant_id, user_id, lesson_id) VALUES ('site-b', 1, 1)`)).rejects.toThrow(/duplicate key|unique/i);
      await db.queryRaw(`INSERT INTO "${PROGRESS}" (tenant_id, user_id, lesson_id) VALUES ('site-c', 1, 1)`);
    } finally {
      await db.queryRaw(`ALTER TABLE "${PROGRESS}" FORCE ROW LEVEL SECURITY`);
    }
  });

  it('builds a partial unique index that enforces only the rows it covers', async (ctx) => {
    if (!db) return ctx.skip();
    await new SchemaManager(db).syncCollection(visits);
    const def = await indexDef('fcp_idxlive_visits_visitor_hash_where_ended_at_idx');
    expect(def).toContain('CREATE UNIQUE INDEX');
    expect(def).toContain('(tenant_id, visitor_hash)');
    expect(def).toMatch(/WHERE \(?"?ended_at"? IS NULL\)?/);

    await insertAsOwner(VISITS, `INSERT INTO "${VISITS}" (tenant_id, visitor_hash, ended_at) VALUES ('site-a', 'h', 'x'), ('site-a', 'h', 'y'), ('site-a', 'h', NULL), ('site-b', 'h', NULL)`);
    await db.queryRaw(`ALTER TABLE "${VISITS}" NO FORCE ROW LEVEL SECURITY`);
    try {
      await expect(db.queryRaw(`INSERT INTO "${VISITS}" (tenant_id, visitor_hash, ended_at) VALUES ('site-a', 'h', NULL)`)).rejects.toThrow(/duplicate key|unique/i);
    } finally {
      await db.queryRaw(`ALTER TABLE "${VISITS}" FORCE ROW LEVEL SECURITY`);
    }
  });

  it('skips a unique over existing duplicates without deleting a row, names the groups through isolation, and builds the rest', async (ctx) => {
    if (!db) return ctx.skip();
    const dupes: ICollection = {
      slug: DUPES,
      fields: [{ name: 'userId', type: 'number' }, { name: 'itemId', type: 'number' }, { name: 'note', type: 'text' }] as any,
      indexes: [{ fields: ['userId', 'itemId'], unique: true }, { fields: ['note'] }],
    };
    // The table exists, isolated, with duplicates already in it — the case a plugin UPDATE meets.
    const withoutIndexes = { ...dupes, indexes: [] };
    await new SchemaManager(db).syncCollection(withoutIndexes);
    await insertAsOwner(DUPES, `INSERT INTO "${DUPES}" (tenant_id, user_id, item_id, note) VALUES ('site-a', 1, 1, 'x'), ('site-a', 1, 1, 'y'), ('site-a', 1, 1, 'z'), ('site-b', 1, 1, 'x'), ('site-b', 2, 2, 'x'), ('site-b', 3, NULL, 'x'), ('site-b', 3, NULL, 'y')`);
    expect(await countAsOwner(DUPES)).toBe(7);

    const warn = vi.fn();
    const plan = new EntitySchemaPlanService().buildPlan(dupes, true, ['id']);
    await new DeclaredIndexEnsurer(db, { info: vi.fn(), warn, error: vi.fn() } as any).ensure(plan);

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('NOT created and is skipped');
    expect(message).toContain('1 key group(s) hold duplicate rows: (tenant_id=site-a, user_id=1, item_id=1) x3');
    expect(message).not.toContain('site-b');           // site-b's (1,1) is a single row; its two NULL item_ids are distinct
    expect(message).toContain('No row was changed');
    expect(await indexDef('fcp_idxlive_dupes_user_id_item_id_idx')).toBe('');
    expect(await indexDef('fcp_idxlive_dupes_note_idx')).toContain('(note)');
    expect(await countAsOwner(DUPES)).toBe(7);

    // Resolve the duplicates; the next sync builds it with no help.
    await insertAsOwner(DUPES, `DELETE FROM "${DUPES}" WHERE note IN ('y', 'z') AND tenant_id = 'site-a'`);
    await new DeclaredIndexEnsurer(db, { info: vi.fn(), warn, error: vi.fn() } as any).ensure(plan);
    expect(await indexDef('fcp_idxlive_dupes_user_id_item_id_idx')).toContain('(tenant_id, user_id, item_id)');
  });

  it('a deployment that gains its first tenant later has the isolation step rewrite the plain unique (partial kept) to the tenant-led form', async (ctx) => {
    if (!db) return ctx.skip();
    await db.queryRaw(`DROP TABLE IF EXISTS "${VISITS}" CASCADE`);
    TenantMode.configure({ tenantCount: 0, dialect: 'postgres', isolationSupported: true });
    await new SchemaManager(db).syncCollection(visits);
    const plain = await indexDef('fcp_idxlive_visits_visitor_hash_where_ended_at_idx');
    expect(plain).toContain('(visitor_hash)');
    expect(plain).not.toContain('tenant_id');

    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    await (new SchemaManager(db) as any).tenantIsolation.applyTenantIsolation(VISITS);
    const scoped = await indexDef('fcp_idxlive_visits_visitor_hash_where_ended_at_idx');
    expect(scoped).toContain('(tenant_id, visitor_hash)');
    expect(scoped).toMatch(/WHERE \(?"?ended_at"? IS NULL\)?/);
  });

  it('answers count, sum and group-by in SQL (the aggregate API plugins use)', async (ctx) => {
    if (!db) return ctx.skip();
    await insertAsOwner(PROGRESS, `INSERT INTO "${PROGRESS}" (tenant_id, user_id, lesson_id, status, score) VALUES ('site-d', 9, 1, 'done', 10), ('site-d', 9, 2, 'done', 20), ('site-d', 9, 3, 'open', 3)`);
    await db.queryRaw(`ALTER TABLE "${PROGRESS}" NO FORCE ROW LEVEL SECURITY`);
    try {
      const rows = await db.aggregate(PROGRESS, {
        where: { tenantId: 'site-d' },
        groupBy: ['status'],
        measures: [
          { fn: AggregateFunction.COUNT, as: 'lessons' },
          { fn: AggregateFunction.SUM, column: 'score', as: 'points' },
          { fn: AggregateFunction.MAX, column: 'score', as: 'best' },
        ],
        orderBy: { by: 'points', direction: SortDirection.DESC },
      });
      expect(rows).toEqual([
        { status: 'done', lessons: 2, points: 30, best: 20 },
        { status: 'open', lessons: 1, points: 3, best: 3 },
      ]);
      expect(await db.count(PROGRESS, { where: { tenantId: 'site-d' } })).toBe(3);
    } finally {
      await db.queryRaw(`ALTER TABLE "${PROGRESS}" FORCE ROW LEVEL SECURITY`);
    }
  });
});
