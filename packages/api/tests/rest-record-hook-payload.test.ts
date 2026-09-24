import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RESTController } from '@api/controllers/rest/rest-controller';

/**
 * A stored row reaches record hooks the way `context.db` hands plugins every other row: canonical
 * camelCase names. It used to arrive in physical snake_case, so a listener reading `orderNumber` got
 * `undefined` — a cancelled order's restock was logged against its id. On an update the hook also
 * carries `_previousData`, the row before the write, which nothing supplied: a hook acting on a
 * TRANSITION (status → cancelled, quantity changed) either never fired or fired on every save.
 */
describe('record hook payloads', () => {
  let controller: RESTController;
  let hooks: any;
  let calls: Array<{ event: string; payload: any }>;
  const collection: any = { slug: 'orders', fields: [{ name: 'orderNumber', type: 'text' }, { name: 'status', type: 'text' }], versions: false };
  const before = { id: 7, order_number: 'ORD-000039', status: 'pending' };
  const after = { id: 7, order_number: 'ORD-000039', status: 'cancelled' };

  beforeEach(() => {
    calls = [];
    hooks = {
      emit: vi.fn(),
      call: vi.fn(async (event: string, payload: any) => { calls.push({ event, payload }); return payload; }),
      on: vi.fn(),
    };
    const mockDb: any = {
      dialect: 'postgres',
      findOne: vi.fn().mockResolvedValue(before),
      update: vi.fn().mockResolvedValue(after),
      find: vi.fn(), insert: vi.fn(), delete: vi.fn(), count: vi.fn().mockResolvedValue(1),
      eq: vi.fn(), and: vi.fn(), or: vi.fn(), desc: vi.fn(), asc: vi.fn(),
    };
    controller = new RESTController(mockDb);
    const runtime = (controller as any).writeController.runtime;
    runtime.hooks = hooks;
    runtime.accessPolicy = { ensureUpdateAllowed: vi.fn(async () => undefined) };
    runtime.logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    runtime.fieldGuard = {
      extractReadOnlyOverrideMetadata: (data: any) => ({ data, overrideMeta: { fields: new Set() } }),
      enforceReadOnlyFieldConstraints: vi.fn(async () => undefined),
      assertPermalinkNotReserved: vi.fn(),
    };
    runtime.localization = { getLocaleContext: vi.fn(async () => ({})) };
    runtime.processor = { processIncomingData: vi.fn(async (_c: any, d: any) => d), filterHiddenFields: (_c: any, d: any) => d };
  });

  const update = async () => {
    const errors: any[] = [];
    const res: any = { json: vi.fn((b: any) => { if (b?.error) errors.push(b.error); return b; }), status: vi.fn().mockReturnThis() };
    await (controller as any).update(collection, { params: { id: '7' }, body: { status: 'cancelled' }, query: {} }, res);
    expect(errors, `update returned an error: ${errors.join(', ')}`).toEqual([]);
    return res.json.mock.calls[0]?.[0];
  };

  it('hands afterSave the row in camelCase, with the row as it was before the write', async () => {
    await update();
    const saved = calls.find((c) => /afterSave/.test(c.event))!.payload;
    expect(saved.orderNumber).toBe('ORD-000039');
    expect(saved.status).toBe('cancelled');
    expect(saved._previousData).toEqual({ id: 7, orderNumber: 'ORD-000039', status: 'pending' });
    expect(calls.find((c) => /afterUpdate/.test(c.event))!.payload._previousData.status).toBe('pending');
  });

  it('keeps the response the stored row, without the previous copy', async () => {
    const body = await update();
    expect(body).toEqual(after);
  });

  it('leaves the incoming data of beforeSave untouched', async () => {
    await update();
    expect(calls.find((c) => /beforeSave/.test(c.event))!.payload).toEqual({ status: 'cancelled' });
  });
});
