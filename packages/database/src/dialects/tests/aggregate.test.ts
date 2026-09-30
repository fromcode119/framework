import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';
import { AggregateStatementBuilder } from '@database/dialects/aggregate-statement-builder';
import { AggregateBucketUnit } from '@database/enums/aggregate-bucket-unit.enum';
import { AggregateFunction } from '@database/enums/aggregate-function.enum';
import { SortDirection } from '@database/enums/sort-direction.enum';

/**
 * `aggregate` — the database computes the report: distinct counts, sums, averages and calendar
 * buckets, instead of an application paging every row into memory to do it.
 */
describe('aggregate', () => {
  const dbPaths: string[] = [];
  afterEach(() => { for (const file of dbPaths.splice(0)) fs.rmSync(file, { force: true }); });

  async function makeDb(): Promise<SqliteDatabaseManager> {
    const dbPath = path.join(os.tmpdir(), `fromcode-sqlite-aggregate-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);
    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute('CREATE TABLE "fcp_events" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "visitor_hash" TEXT, "utm_source" TEXT, "path" TEXT, "duration" REAL, "created_at" TEXT)');
    const rows: Array<[string, string | null, string, number, string]> = [
      ['a', 'google', '/', 10, '2026-09-28 09:15:00'],
      ['a', 'google', '/blog', 30, '2026-09-28 09:40:00'],
      ['b', 'linkedin', '/', 5, '2026-09-28 10:05:00'],
      ['c', null, '/contact', 60, '2026-09-29 11:00:00'],
      ['c', null, '/', 20, '2026-09-29 11:20:00'],
      ['d', 'google', '/', 40, '2026-10-05 08:00:00'],
    ];
    for (const [visitorHash, utmSource, pathValue, duration, createdAt] of rows) {
      await manager.insert('fcp_events', { visitorHash, utmSource, path: pathValue, duration, createdAt });
    }
    return manager;
  }

  it('counts rows and distinct values per group, returned under camelCase keys, biggest first', async () => {
    const manager = await makeDb();
    const rows = await manager.aggregate('fcp_events', {
      groupBy: ['utmSource'],
      measures: [{ fn: AggregateFunction.COUNT, as: 'pageviews' }, { fn: AggregateFunction.COUNT_DISTINCT, column: 'visitorHash', as: 'visitors' }],
    });
    expect(rows[0]).toEqual({ utmSource: 'google', pageviews: 3, visitors: 2 });
    expect(rows.find((row) => row.utmSource === 'linkedin')).toEqual({ utmSource: 'linkedin', pageviews: 1, visitors: 1 });
    expect(rows.find((row) => row.utmSource === null)).toEqual({ utmSource: null, pageviews: 2, visitors: 1 });
  });

  it('sums and averages, and answers 0 / null for an empty window', async () => {
    const manager = await makeDb();
    const [totals] = await manager.aggregate('fcp_events', { measures: [{ fn: AggregateFunction.SUM, column: 'duration', as: 'total' }, { fn: AggregateFunction.AVG, column: 'duration', as: 'average' }] });
    expect(totals).toEqual({ total: 165, average: 27.5 });
    const [empty] = await manager.aggregate('fcp_events', { where: { path: '/nowhere' }, measures: [{ fn: AggregateFunction.COUNT, as: 'n' }, { fn: AggregateFunction.AVG, column: 'duration', as: 'average' }] });
    expect(empty).toEqual({ n: 0, average: null });
  });

  it('buckets by hour, day, ISO week and month, oldest first', async () => {
    const manager = await makeDb();
    const by = async (unit: AggregateBucketUnit) => Object.fromEntries((await manager.aggregate('fcp_events', {
      bucket: { column: 'createdAt', unit }, measures: [{ fn: AggregateFunction.COUNT, as: 'n' }],
    })).map((row) => [row.bucket, row.n]));
    expect(await by(AggregateBucketUnit.DAY)).toEqual({ '2026-09-28': 3, '2026-09-29': 2, '2026-10-05': 1 });
    expect(await by(AggregateBucketUnit.HOUR)).toEqual({ '2026-09-28T09:00': 2, '2026-09-28T10:00': 1, '2026-09-29T11:00': 2, '2026-10-05T08:00': 1 });
    // 2026-09-28 is a Monday; 2026-10-05 is the next-but-one Monday.
    expect(await by(AggregateBucketUnit.WEEK)).toEqual({ '2026-09-28': 5, '2026-10-05': 1 });
    expect(await by(AggregateBucketUnit.MONTH)).toEqual({ '2026-09-01': 5, '2026-10-01': 1 });
    const ordered = await manager.aggregate('fcp_events', { bucket: { column: 'createdAt', unit: AggregateBucketUnit.DAY }, measures: [{ fn: AggregateFunction.COUNT, as: 'n' }] });
    expect(ordered.map((row) => row.bucket)).toEqual(['2026-09-28', '2026-09-29', '2026-10-05']);
  });

  it('filters, orders by a named key and pages', async () => {
    const manager = await makeDb();
    const rows = await manager.aggregate('fcp_events', {
      where: { createdAt: { gte: '2026-09-28 00:00:00', lte: '2026-09-29 23:59:59' } },
      groupBy: ['path'],
      measures: [{ fn: AggregateFunction.COUNT, as: 'views' }],
      orderBy: { by: 'path', direction: SortDirection.ASC },
      limit: 2,
    });
    expect(rows).toEqual([{ path: '/', views: 3 }, { path: '/blog', views: 1 }]);
  });
});

describe('AggregateStatementBuilder — what reaches SQL as code', () => {
  const hooks = {
    quoteIdentifier: (name: string) => `"${name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}"`,
    getParamPlaceholder: (i: number) => `$${i}`,
    getLikeOperator: () => 'ILIKE',
    patternColumnExpression: (c: string) => c,
    dayBucketExpression: (c: string) => c,
    bucketExpression: (c: string, unit: string, zone: string) => `to_char(date_trunc('${unit}', ${c} AT TIME ZONE '${zone}'), 'YYYY-MM-DD')`,
    renderPredicate: () => '',
  };
  const builder = new AggregateStatementBuilder(hooks as any, () => ({ sql: ' WHERE "tenant_id" = $1', values: ['site'] }));

  it('builds one grouped statement with the site zone and bound filter values', () => {
    const { sql, values } = builder.build('fcp_analytics_events', {
      groupBy: ['utmSource'],
      bucket: { column: 'createdAt', unit: AggregateBucketUnit.DAY, timeZone: 'Europe/Sofia' },
      measures: [{ fn: AggregateFunction.COUNT_DISTINCT, column: 'visitorHash', as: 'visitors' }],
    });
    expect(sql).toBe(`SELECT "utm_source" AS "utmSource", to_char(date_trunc('day', "created_at" AT TIME ZONE 'Europe/Sofia'), 'YYYY-MM-DD') AS "bucket", COUNT(DISTINCT "visitor_hash") AS "visitors" FROM "fcp_analytics_events" WHERE "tenant_id" = $1 GROUP BY "utm_source", to_char(date_trunc('day', "created_at" AT TIME ZONE 'Europe/Sofia'), 'YYYY-MM-DD') ORDER BY "bucket" ASC`);
    expect(values).toEqual(['site']);
  });

  it('accepts the wire form a sandboxed plugin sends: each Enum as its string value', () => {
    const wire = JSON.parse(JSON.stringify({
      bucket: { column: 'createdAt', unit: AggregateBucketUnit.WEEK },
      measures: [{ fn: AggregateFunction.COUNT_DISTINCT, column: 'visitorHash', as: 'visitors' }],
      orderBy: { by: 'visitors', direction: SortDirection.ASC },
    }));
    expect(wire.measures[0].fn).toBe('countDistinct');
    const { sql } = builder.build('t', wire);
    expect(sql).toContain('COUNT(DISTINCT');
    expect(sql).toContain('ORDER BY "visitors" ASC');
    expect(() => builder.build('t', { ...wire, orderBy: { by: 'visitors', direction: 'sideways' } })).toThrow(/Invalid orderBy direction/);
  });

  it('refuses a time zone the runtime does not know, or one shaped like SQL', () => {
    expect(() => AggregateStatementBuilder.validTimeZone("Europe/Sofia'; DROP TABLE x; --")).toThrow(/Invalid time zone/);
    expect(() => AggregateStatementBuilder.validTimeZone('Mars/Olympus')).toThrow(/Invalid time zone/);
    expect(AggregateStatementBuilder.validTimeZone('')).toBe('UTC');
  });

  it('refuses unsafe result keys, unknown functions and units, and an order on a key it does not return', () => {
    const base = { measures: [{ fn: AggregateFunction.COUNT, as: 'n' }] };
    expect(() => builder.build('t', { measures: [{ fn: AggregateFunction.COUNT, as: 'n" FROM x --' }] })).toThrow(/Invalid measure name/);
    expect(() => builder.build('t', { measures: [{ fn: 'median' as any, column: 'a', as: 'n' }] })).toThrow(/Invalid aggregate function/);
    expect(() => builder.build('t', { ...base, bucket: { column: 'createdAt', unit: 'year' as any } })).toThrow(/Invalid bucket unit/);
    expect(() => builder.build('t', { ...base, orderBy: { by: 'other' } })).toThrow(/not a returned key/);
    expect(() => builder.build('t', { measures: [] })).toThrow(/at least one measure/);
    expect(() => builder.build('t', { measures: [{ fn: AggregateFunction.SUM, as: 'n' }] })).toThrow(/needs a column/);
  });
});
