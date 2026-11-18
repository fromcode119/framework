import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventIdempotency } from '@core/plugin/events/event-idempotency';

function fakeDb(opts: { existing?: any; insertThrows?: boolean } = {}) {
  const calls: { insert: any[]; delete: any[]; findOne: any[] } = { insert: [], delete: [], findOne: [] };
  return {
    calls,
    findOne: vi.fn(async (_t: string, where: any) => { calls.findOne.push(where); return opts.existing ?? null; }),
    insert: vi.fn(async (_t: string, row: any) => { calls.insert.push(row); if (opts.insertThrows) throw new Error('unique violation'); }),
    delete: vi.fn(async (_t: string, where: any) => { calls.delete.push(where); return true; }),
  };
}

describe('EventIdempotency.once', () => {
  afterEach(() => vi.restoreAllMocks());

  it('runs the effect and claims the key the first time', async () => {
    const db = fakeDb();
    const fn = vi.fn(async () => 'result');
    const out = await EventIdempotency.once({ db } as never, 'order:completed:sample-keys', 'ORD-1', fn);
    expect(out).toMatchObject({ ran: true, result: 'result' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(db.calls.insert[0]).toMatchObject({ scope: 'order:completed:sample-keys', dedupe_key: 'ORD-1' });
  });

  it('skips the effect when the key was already handled', async () => {
    const db = fakeDb({ existing: { id: 1 } });
    const fn = vi.fn();
    const out = await EventIdempotency.once({ db } as never, 's', 'k', fn);
    expect(out).toMatchObject({ ran: false, skipped: true });
    expect(fn).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('a concurrent duplicate loses the unique-index race and is skipped', async () => {
    const db = fakeDb({ insertThrows: true });
    const fn = vi.fn();
    const out = await EventIdempotency.once({ db } as never, 's', 'k', fn);
    expect(out).toMatchObject({ ran: false, skipped: true });
    expect(fn).not.toHaveBeenCalled();
  });

  it('releases the claim when the effect throws, so it can run again', async () => {
    const db = fakeDb();
    const fn = vi.fn(async () => { throw new Error('effect failed'); });
    await expect(EventIdempotency.once({ db } as never, 's', 'k', fn)).rejects.toThrow('effect failed');
    expect(db.delete).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ dedupe_key: 'k' }));
  });

  it('runs without deduplicating when there is no key', async () => {
    const db = fakeDb();
    const fn = vi.fn(async () => 1);
    const out = await EventIdempotency.once({ db } as never, 's', '', fn);
    expect(out.ran).toBe(true);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
