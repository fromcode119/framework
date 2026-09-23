import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RESTController } from '@api/controllers/rest/rest-controller';

/**
 * `beforeDelete` and `afterDelete` are declared in the hook vocabulary and on ICollection, and no
 * controller dispatched either — the delete path only emitted the past-tense `deleted` notification.
 * That dead contract already cost once: a content plugin listened on beforeDelete/afterDelete, heard
 * nothing, and a shop plugin's product->page references were left dangling when a page was removed.
 *
 * `beforeDelete` has to carry the RECORD, because that is the only moment a listener can still read
 * what it is about to lose — an order's number, say, to check what paperwork it leaves behind.
 */
describe('rest delete hooks', () => {
  let controller: RESTController;
  let mockDb: any;
  let hooks: any;
  let emitted: Array<{ event: string; payload: any }>;

  const collection: any = { slug: 'orders', fields: [{ name: 'orderNumber', type: 'text' }] };
  const record = { id: 7, orderNumber: 'ORD-000039' };

  beforeEach(() => {
    emitted = [];
    hooks = {
      emit: vi.fn((event: string, payload: any) => { emitted.push({ event, payload }); }),
      call: vi.fn(async (event: string, payload: any) => { emitted.push({ event, payload }); return payload; }),
      on: vi.fn(),
    };
    mockDb = {
      dialect: 'postgres',
      findOne: vi.fn().mockResolvedValue(record),
      delete: vi.fn().mockResolvedValue(true),
      find: vi.fn(), insert: vi.fn(), update: vi.fn(), count: vi.fn().mockResolvedValue(1),
      eq: vi.fn(), and: vi.fn(), or: vi.fn(), desc: vi.fn(), asc: vi.fn(),
    };
    controller = new RESTController(mockDb);
    const runtime = (controller as any).writeController.runtime;
    runtime.hooks = hooks;
    // The access policy and the logger are not what is under test here.
    runtime.accessPolicy = { ensureDeleteAllowed: vi.fn(async () => undefined) };
    runtime.logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  const runDelete = async () => {
    const req: any = { params: { id: '7' }, query: {} };
    const errors: any[] = [];
    const res: any = { json: vi.fn((b: any) => { if (b?.error) errors.push(b.error); }), status: vi.fn().mockReturnThis() };
    await (controller as any).delete(collection, req, res);
    // A swallowed error would otherwise look exactly like "the hook did not fire".
    expect(errors, `delete returned an error: ${errors.join(', ')}`).toEqual([]);
  };

  it('dispatches beforeDelete WITH the record, before the row is gone', async () => {
    await runDelete();
    const before = emitted.find((e) => /beforeDelete/i.test(e.event));
    expect(before, 'beforeDelete was not dispatched').toBeTruthy();
    expect(before!.payload).toEqual(record);
    expect(mockDb.findOne.mock.invocationCallOrder[0]).toBeLessThan(mockDb.delete.mock.invocationCallOrder[0]);
  });

  it('dispatches afterDelete once the row is gone', async () => {
    await runDelete();
    const after = emitted.find((e) => /afterDelete/i.test(e.event));
    expect(after, 'afterDelete was not dispatched').toBeTruthy();
    expect(after!.payload).toEqual({ id: 7 });
  });

  it('still emits the past-tense notification the existing listeners rely on', async () => {
    await runDelete();
    expect(emitted.some((e) => /deleted/.test(e.event) && e.payload?.id === 7)).toBe(true);
  });

  it('does not dispatch beforeDelete for a record that is not there', async () => {
    mockDb.findOne.mockResolvedValue(null);
    await runDelete();
    expect(emitted.some((e) => /beforeDelete/i.test(e.event))).toBe(false);
  });
});
