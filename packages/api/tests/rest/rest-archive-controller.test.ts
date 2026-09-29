import { describe, expect, it, vi } from 'vitest';
import { RestArchiveController } from '@api/controllers/rest/rest-archive-controller';

type Row = Record<string, any>;

/** Tables keyed by physical name; rows stored snake_case, as the raw manager returns them. */
function memoryDb(tables: Record<string, Row[]>) {
  const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  const matches = (row: Row, where: Row) => Object.entries(where).every(([key, expected]) => {
    const actual = row[snake(key)];
    if (expected && typeof expected === 'object' && 'in' in expected) return expected.in.includes(actual);
    if (expected === null) return actual === null || actual === undefined;
    return actual === expected;
  });
  return {
    tables,
    find: vi.fn(async (table: string, options: { where: Row }) => (tables[table] ?? []).filter((row) => matches(row, options.where))),
    update: vi.fn(async (table: string, where: Row, data: Row) => {
      const row = (tables[table] ?? []).find((candidate) => matches(candidate, where));
      if (!row) return null;
      for (const [key, value] of Object.entries(data)) row[snake(key)] = value;
      return row;
    }),
  };
}

function runtimeFor(db: any, deniedSlugs: string[] = []) {
  return {
    db,
    logger: { error: vi.fn(), warn: vi.fn() },
    accessPolicy: {
      ensureUpdateAllowed: vi.fn(async (collection: any) => {
        if (deniedSlugs.includes(collection.slug)) throw Object.assign(new Error('no'), { statusCode: 403 });
      }),
    },
    resolveWriteTarget: (collection: any) => collection.slug,
    resolveRecordIdentifier: (_collection: any, row: any) => row.id,
    requireRecordIdentifier: (_collection: any, id: string) => Number(id),
    emitCollectionEvent: vi.fn(),
  } as any;
}

function response() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
}

const orders = { slug: 'fcp_shop_orders', fields: [], archive: { leads: { orderNumber: 'orderNumber' } } } as any;
const invoices = { slug: 'fcp_money_invoices', displayName: 'Invoices', fields: [], archive: { follows: { orderNumber: 'orderNumber' } } } as any;
const shipments = { slug: 'fcp_post_shipments', displayName: 'Shipments', fields: [], archive: { follows: { orderNumber: 'orderNumber' } } } as any;
const notes = { slug: 'fcp_notes_notes', fields: [] } as any;

function setup(deniedSlugs: string[] = []) {
  const db = memoryDb({
    fcp_shop_orders: [{ id: 1, order_number: 'ORD-1' }, { id: 2, order_number: 'ORD-2' }],
    fcp_money_invoices: [
      { id: 10, order_number: 'ORD-1' },
      { id: 11, order_number: 'ORD-1', archived_at: new Date('2026-01-01'), archived_with: null },
      { id: 12, order_number: 'ORD-2' },
    ],
    fcp_post_shipments: [{ id: 20, order_number: 'ORD-1' }],
  });
  const runtime = runtimeFor(db, deniedSlugs);
  const controller = new RestArchiveController(runtime);
  controller.useCollections(() => [orders, invoices, shipments, notes]);
  return { db, runtime, controller };
}

describe('archive and restore', () => {
  it('archives an order and the records that follow its number, and only those', async () => {
    const { db, controller } = setup();
    const res = response();
    await controller.archive(orders, { body: { ids: [1] } }, res);

    expect(res.body.count).toBe(1);
    expect(res.body.cascaded).toEqual([
      { collection: 'fcp_money_invoices', label: 'Invoices', count: 1 },
      { collection: 'fcp_post_shipments', label: 'Shipments', count: 1 },
    ]);
    const [order] = db.tables.fcp_shop_orders;
    expect(order.archived_at).toBeInstanceOf(Date);
    expect(db.tables.fcp_money_invoices[0]).toMatchObject({ archived_with: 'fcp_shop_orders:1', archived_at: order.archived_at });
    // Archived on its own before: keeps its own stamp and is not claimed by the order.
    expect(db.tables.fcp_money_invoices[1].archived_with).toBeNull();
    // Another order's invoice is untouched.
    expect(db.tables.fcp_money_invoices[2].archived_at).toBeUndefined();
  });

  it('restores exactly what the order took along', async () => {
    const { db, controller } = setup();
    await controller.archive(orders, { body: { ids: [1] } }, response());
    const res = response();
    await controller.restore(orders, { body: { ids: [1] } }, res);

    expect(res.body.count).toBe(1);
    expect(db.tables.fcp_shop_orders[0].archived_at).toBeNull();
    expect(db.tables.fcp_money_invoices[0].archived_at).toBeNull();
    expect(db.tables.fcp_post_shipments[0].archived_at).toBeNull();
    expect(db.tables.fcp_money_invoices[1].archived_at).toEqual(new Date('2026-01-01'));
  });

  it('archives a follower on its own without reaching its siblings', async () => {
    const { db, controller } = setup();
    const res = response();
    await controller.archive(invoices, { body: { ids: [10] } }, res);
    expect(res.body.cascaded).toEqual([]);
    expect(db.tables.fcp_post_shipments[0].archived_at).toBeUndefined();
  });

  it('leaves a follower the operator may not update alone, and says so', async () => {
    const { db, controller } = setup(['fcp_post_shipments']);
    const res = response();
    await controller.archive(orders, { body: { ids: [1] } }, res);
    expect(res.body.cascaded).toContainEqual({ collection: 'fcp_post_shipments', label: 'Shipments', count: 0, skipped: 'permission' });
    expect(db.tables.fcp_post_shipments[0].archived_at).toBeUndefined();
  });

  it('refuses a collection that is not archivable', async () => {
    const { controller } = setup();
    const res = response();
    await controller.archive(notes, { body: { ids: [1] } }, res);
    expect(res.statusCode).toBe(400);
  });
});
