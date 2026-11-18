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

    await EventDeliveryLedger.recordFailure(manager, { event: 'order:completed', pluginSlug: 'sample-keys', payload: { a: 1 }, error: new Error('boom') });
    expect(db.insert).toHaveBeenCalledTimes(1);
    const inserted = db.calls.insert[0][1];
    expect(inserted).toMatchObject({ event: 'order:completed', plugin_slug: 'sample-keys', status: 'failed', attempts: 1, error: 'boom' });
    expect(inserted.payload).toBe(JSON.stringify({ a: 1 }));

    db.setExisting({ id: 7, attempts: 1 });
    await EventDeliveryLedger.recordFailure(manager, { event: 'order:completed', pluginSlug: 'sample-keys', payload: { a: 2 }, error: new Error('again') });
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

  it('redacts secret-named keys and stores no payload at all for an auth event', async () => {
    const db = fakeDb();
    await EventDeliveryLedger.recordFailure({ db } as any, {
      event: 'user:registered', pluginSlug: 'p',
      payload: { email: 'a@b.c', password: 'hunter2', profile: { token: 'xyz', name: 'Al' } }, error: 'e',
    });
    expect(JSON.parse(db.calls.insert[0][1].payload)).toEqual({
      email: 'a@b.c', password: '[redacted]', profile: { token: '[redacted]', name: 'Al' },
    });

    const authDb = fakeDb();
    await EventDeliveryLedger.recordFailure({ db: authDb } as any, {
      event: 'auth:password:reset', pluginSlug: 'p', payload: { newPassword: 'secret' }, error: 'e',
    });
    expect(authDb.calls.insert[0][1].payload).toBeNull();
  });

  it('drops the payload for an event whose name carries a secret word anywhere (not only between delimiters)', async () => {
    const db = fakeDb();
    await EventDeliveryLedger.recordFailure({ db } as any, {
      event: 'user:passwordReset', pluginSlug: 'p', payload: { email: 'a@b.c' }, error: 'e',
    });
    expect(db.calls.insert[0][1].payload).toBeNull();
  });

  it('scrubs secret-shaped substrings out of ordinary string values and the stored error', async () => {
    const db = fakeDb();
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.abcdef123456';
    await EventDeliveryLedger.recordFailure({ db } as any, {
      event: 'order:completed', pluginSlug: 'p',
      payload: { callbackUrl: 'https://x.test/cb?order=9&access_token=SEKRET', note: `Bearer ${jwt}` },
      error: new Error(`POST https://api.test/charge?api_key=LIVEKEY failed with ${jwt}`),
    });
    const stored = JSON.parse(db.calls.insert[0][1].payload);
    expect(stored.callbackUrl).toBe('https://x.test/cb?order=9&access_token=[redacted]');
    expect(stored.note).not.toContain(jwt);
    const error = db.calls.insert[0][1].error;
    expect(error).toContain('[redacted]');
    expect(error).not.toContain('LIVEKEY');
    expect(error).not.toContain(jwt);
  });

  it('listOpenFailures maps rows to the console shape', async () => {
    const db = fakeDb();
    (db.find as any).mockResolvedValue([{ id: 3, event: 'x', plugin_slug: 'p', tenant_id: '5', attempts: 2, error: 'oops', payload: '{"n":1}', updated_at: 'now' }]);
    const manager: any = { db };
    const rows = await EventDeliveryLedger.listOpenFailures(manager);
    expect(rows[0]).toMatchObject({ id: 3, event: 'x', pluginSlug: 'p', tenantId: '5', attempts: 2, error: 'oops', payload: { n: 1 } });
  });
});
