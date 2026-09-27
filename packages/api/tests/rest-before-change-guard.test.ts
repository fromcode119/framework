import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RESTController } from '@api/controllers/rest/rest-controller';

/**
 * `beforeChange` is a GUARD: once per stored record, right before its update is written, a listener
 * sees the incoming changes and the record as stored (`_previousData`) and refuses by throwing.
 * `beforeUpdate`/`beforeSave` never see the stored record, so "this may not change once the record is
 * paid" could not be enforced from a hook. Bulk edits and bulk deletes go through the same guards —
 * bulk delete used to skip `beforeDelete` entirely.
 */
describe('record guards', () => {
  let controller: RESTController;
  let hooks: any;
  let calls: Array<{ event: string; payload: any }>;
  let mockDb: any;
  let refuse: ((event: string, payload: any) => boolean) | null;
  const collection: any = { slug: 'invoices', fields: [{ name: 'totalAmount', type: 'number' }, { name: 'status', type: 'text' }], versions: false };
  const stored = { id: 7, total_amount: 30, status: 'paid' };

  beforeEach(() => {
    calls = [];
    refuse = null;
    hooks = {
      emit: vi.fn(),
      call: vi.fn(async (event: string, payload: any) => {
        calls.push({ event, payload });
        if (refuse?.(event, payload)) throw Object.assign(new Error('Paid invoices cannot be changed'), { statusCode: 409 });
        return payload;
      }),
      on: vi.fn(),
    };
    mockDb = {
      dialect: 'postgres',
      findOne: vi.fn().mockResolvedValue(stored),
      update: vi.fn().mockResolvedValue({ ...stored, total_amount: 99 }),
      find: vi.fn().mockResolvedValue([stored, { id: 8, total_amount: 5, status: 'draft' }]),
      insert: vi.fn(), delete: vi.fn().mockResolvedValue(true), count: vi.fn().mockResolvedValue(1),
      eq: vi.fn(), and: vi.fn(), or: vi.fn(), desc: vi.fn(), asc: vi.fn(), inArray: vi.fn(() => ({})),
    };
    controller = new RESTController(mockDb);
    const runtime = (controller as any).writeController.runtime;
    runtime.hooks = hooks;
    runtime.accessPolicy = { ensureUpdateAllowed: vi.fn(async () => undefined), ensureDeleteAllowed: vi.fn(async () => undefined) };
    runtime.logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    runtime.fieldGuard = {
      extractReadOnlyOverrideMetadata: (data: any) => ({ data, overrideMeta: { fields: new Set() } }),
      enforceReadOnlyFieldConstraints: vi.fn(async () => undefined),
      assertPermalinkNotReserved: vi.fn(),
    };
    runtime.localization = { getLocaleContext: vi.fn(async () => ({})) };
    runtime.processor = { processIncomingData: vi.fn(async (_c: any, d: any) => d), filterHiddenFields: (_c: any, d: any) => d };
  });

  const respond = () => {
    const out: { status?: number; body?: any } = {};
    const res: any = { status: vi.fn((s: number) => { out.status = s; return res; }), json: vi.fn((b: any) => { out.body = b; return b; }) };
    return { res, out };
  };

  it('an update shows the guard the changes and the stored record, in camelCase', async () => {
    const { res } = respond();
    await (controller as any).update(collection, { params: { id: '7' }, body: { totalAmount: 99 }, query: {} }, res);
    const guard = calls.find((c) => /:beforeChange$/.test(c.event))!;
    expect(guard.payload.totalAmount).toBe(99);
    expect(guard.payload._previousData).toEqual({ id: 7, totalAmount: 30, status: 'paid' });
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('a guard that refuses stops the write and answers its status', async () => {
    refuse = (event) => /:beforeChange$/.test(event);
    const { res, out } = respond();
    await (controller as any).update(collection, { params: { id: '7' }, body: { totalAmount: 99 }, query: {} }, res);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(out.status).toBe(409);
    expect(out.body.error).toMatch(/Paid invoices cannot be changed/);
  });

  it('a bulk edit asks the guard for every record', async () => {
    refuse = (event, payload) => /:beforeChange$/.test(event) && payload._previousData?.status === 'paid';
    const { res } = respond();
    await (controller as any).bulkUpdate(collection, { body: { ids: [7], data: { totalAmount: 99 } }, query: {} }, res);
    expect(calls.some((c) => /:beforeChange$/.test(c.event))).toBe(true);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('a bulk delete fires beforeDelete for every row, and one refusal deletes nothing', async () => {
    refuse = (event, payload) => /:beforeDelete$/.test(event) && payload.status === 'paid';
    const { res, out } = respond();
    await (controller as any).bulkDelete(collection, { body: { ids: [7, 8] }, query: {} }, res);
    expect(calls.filter((c) => /:beforeDelete$/.test(c.event)).length).toBeGreaterThanOrEqual(1);
    expect(mockDb.delete).not.toHaveBeenCalled();
    expect(out.status).toBe(409);
  });

  it('a bulk delete nobody refuses still deletes, after every row was shown to beforeDelete', async () => {
    const { res } = respond();
    await (controller as any).bulkDelete(collection, { body: { ids: [7, 8] }, query: {} }, res);
    expect(calls.filter((c) => /:beforeDelete$/.test(c.event)).map((c) => c.payload.id)).toEqual([7, 8]);
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });
});
