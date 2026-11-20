import { describe, expect, it, vi } from 'vitest';
import { PluginGuestContextFactory } from '@core/plugin/host/plugin-guest-context-factory';
import { EventIdempotency } from '@core/plugin/events/event-idempotency';

/**
 * An ISOLATED plugin's `context.events.once` must really be at most once.
 *
 * It used to run the effect every time ("does not yet deduplicate"). A plugin written against the
 * in-process promise — finance issuing one invoice per order — then ran isolated in production, and two
 * requests arriving in the same millisecond issued two invoices for one order.
 */
const guestEvents = (claimed: boolean) => {
  const calls: Array<{ name: string; key: string }> = [];
  const remote = {
    call: vi.fn(async (_target: string, path: Array<{ name: string; args?: unknown[] }>) => {
      const step = path[1];
      calls.push({ name: step.name, key: String(step.args?.[0]) });
      return step.name === 'claim' ? claimed : undefined;
    }),
  };
  const factory = Object.create(PluginGuestContextFactory.prototype);
  Object.assign(factory, { remote });
  return { events: (factory as any).events(), calls };
};

describe('isolated plugin: context.events.once', () => {
  it('claims the key on the host, then runs the effect', async () => {
    const { events, calls } = guestEvents(true);
    const effect = vi.fn(async () => 'invoice-1');

    await expect(events.once('invoice:ORD-1', effect)).resolves.toEqual({ ran: true, result: 'invoice-1' });

    expect(calls).toEqual([{ name: 'claim', key: 'invoice:ORD-1' }]);
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('does not run the effect when the host says the key is already held', async () => {
    const { events } = guestEvents(false);
    const effect = vi.fn();

    await expect(events.once('invoice:ORD-1', effect)).resolves.toEqual({ ran: false, skipped: true });

    expect(effect).not.toHaveBeenCalled();
  });

  it('gives the claim back when the effect throws, so it can be tried again', async () => {
    const { events, calls } = guestEvents(true);

    await expect(events.once('invoice:ORD-1', async () => { throw new Error('provider down'); })).rejects.toThrow('provider down');

    expect(calls.map((call) => call.name)).toEqual(['claim', 'forget']);
  });

  it('forget asks the host to release the key', async () => {
    const { events, calls } = guestEvents(true);

    await events.forget('invoice:ORD-1');

    expect(calls).toEqual([{ name: 'forget', key: 'invoice:ORD-1' }]);
  });
});

describe('EventIdempotency.claim / release', () => {
  const store = () => {
    const rows = new Set<string>();
    const id = (where: any) => `${where.scope}|${where.dedupe_key}|${where.tenant_id}`;
    return {
      rows,
      findOne: vi.fn(async (_table: string, where: any) => (rows.has(id(where)) ? { id: 1 } : null)),
      insert: vi.fn(async (_table: string, row: any) => { if (rows.has(id(row))) throw new Error('unique violation'); rows.add(id(row)); }),
      delete: vi.fn(async (_table: string, where: any) => { rows.delete(id(where)); return true; }),
    };
  };

  it('of two claims for one key exactly one wins, and a release lets the next one win', async () => {
    const db = store();
    const manager = { db } as never;

    expect(await EventIdempotency.claim(manager, 'finance', 'invoice:ORD-1')).toBe(true);
    expect(await EventIdempotency.claim(manager, 'finance', 'invoice:ORD-1')).toBe(false);

    await EventIdempotency.release(manager, 'finance', 'invoice:ORD-1');

    expect(await EventIdempotency.claim(manager, 'finance', 'invoice:ORD-1')).toBe(true);
  });

  it('a claim that loses the insert race is refused even though the lookup saw nothing', async () => {
    const db = store();
    db.findOne.mockResolvedValue(null);
    db.rows.add('finance|invoice:ORD-1|');

    expect(await EventIdempotency.claim({ db } as never, 'finance', 'invoice:ORD-1')).toBe(false);
  });
});
