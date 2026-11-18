import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventDeliveryLedger } from '@core/plugin/events/event-delivery-ledger';

function fakeDb() {
  const calls: { insert: any[]; update: any[]; findOne: any[] } = { insert: [], update: [], findOne: [] };
  let existing: any = null;
  return {
    calls,
    setExisting: (row: any) => { existing = row; },
    insert: vi.fn(async (table: string, row: any) => { calls.insert.push([table, row]); }),
    update: vi.fn(async (table: string, where: any, patch: any) => { calls.update.push([table, where, patch]); }),
    findOne: vi.fn(async (table: string, where: any) => { calls.findOne.push([table, where]); return existing; }),
    find: vi.fn(async () => []),
  };
}

describe('EventDeliveryLedger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('records a new failure, then raises the attempt count on a repeat of the same listener', async () => {
    const db = fakeDb();
    const manager: any = { db };

    await EventDeliveryLedger.recordFailure(manager, { event: 'order:completed', pluginSlug: 'licensing', payload: { a: 1 }, error: new Error('boom') });
    expect(db.insert).toHaveBeenCalledTimes(1);
    const inserted = db.calls.insert[0][1];
    expect(inserted).toMatchObject({ event: 'order:completed', plugin_slug: 'licensing', status: 'failed', attempts: 1, error: 'boom' });
    expect(inserted.payload).toBe(JSON.stringify({ a: 1 }));

    db.setExisting({ id: 7, attempts: 1 });
    await EventDeliveryLedger.recordFailure(manager, { event: 'order:completed', pluginSlug: 'licensing', payload: { a: 2 }, error: new Error('again') });
    expect(db.update).toHaveBeenCalledWith(expect.any(String), { id: 7 }, expect.objectContaining({ attempts: 2, error: 'again' }));
  });

  it('markResolved clears a failed row only when a failure is known in this process (no DB hit otherwise)', async () => {
    const db = fakeDb();
    const manager: any = { db };

    await EventDeliveryLedger.markResolved(manager, { event: 'cold:event', pluginSlug: 'fresh' });
    expect(db.update).not.toHaveBeenCalled();

    await EventDeliveryLedger.recordFailure(manager, { event: 'warm:event', pluginSlug: 'known', payload: null, error: 'x' });
    await EventDeliveryLedger.markResolved(manager, { event: 'warm:event', pluginSlug: 'known' });
    expect(db.update).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ event: 'warm:event', plugin_slug: 'known', status: 'failed' }),
      expect.objectContaining({ status: 'resolved' }),
    );
  });

  it('never throws when the database write fails — the ledger must not break a delivery', async () => {
    const manager: any = { db: { findOne: async () => { throw new Error('db down'); }, insert: async () => {}, update: async () => {} } };
    await expect(EventDeliveryLedger.recordFailure(manager, { event: 'e', pluginSlug: 'p', payload: 1, error: 'e' })).resolves.toBeUndefined();
  });

  it('listOpenFailures maps rows to the console shape', async () => {
    const db = fakeDb();
    (db.find as any).mockResolvedValue([{ id: 3, event: 'x', plugin_slug: 'p', tenant_id: 5, attempts: 2, error: 'oops', payload: '{"n":1}', updated_at: 'now' }]);
    const manager: any = { db };
    const rows = await EventDeliveryLedger.listOpenFailures(manager);
    expect(rows[0]).toMatchObject({ id: 3, event: 'x', pluginSlug: 'p', tenantId: 5, attempts: 2, error: 'oops', payload: { n: 1 } });
  });
});
