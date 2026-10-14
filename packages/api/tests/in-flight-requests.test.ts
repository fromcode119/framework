import { afterEach, describe, expect, it, vi } from 'vitest';
import { InFlightRequests } from '@api/server/in-flight-requests';
import { DatabasePoolRegistry } from '@fromcode119/database';
import { DatabasePoolWatch } from '@api/server/database-pool-watch';

/** A full database pool used to say how many requests were waiting, never whose. */
describe('InFlightRequests', () => {
  afterEach(() => { InFlightRequests.reset(); vi.restoreAllMocks(); });

  const arrive = (hostname: string, path: string) => {
    const closers: Array<() => void> = [];
    const res: any = { on: (event: string, fn: () => void) => { if (event === 'close') closers.push(fn); } };
    InFlightRequests.middleware()({ hostname, path } as any, res, () => undefined);
    return () => closers.forEach((close) => close());
  };

  it('counts requests while they are open and forgets them when they close', () => {
    const leave = arrive('shop.example', '/api/v1/cart');
    arrive('shop.example', '/api/v1/cart');
    expect(InFlightRequests.summary()).toContain('In flight 2');

    leave();
    expect(InFlightRequests.summary()).toContain('In flight 1');
  });

  it('groups by site and route, biggest first, folding ids into one route', () => {
    for (let i = 0; i < 3; i++) arrive('finestra.example', `/api/v1/orders/${100 + i}`);
    arrive('finestra.example', '/api/v1/orders/9b2f0d7e-1c3a-4e5b-8a6c-0123456789ab');
    arrive('other.example', '/api/v1/system/frontend');

    const summary = InFlightRequests.summary();

    expect(summary).toContain('In flight 5');
    expect(summary).toContain('finestra.example /api/v1/orders/:id ×4');
    expect(summary.indexOf('finestra.example')).toBeLessThan(summary.indexOf('other.example'));
  });

  it('names how long the oldest request in a group has been open', () => {
    arrive('shop.example', '/slow');
    const later = Date.now() + 3400;

    expect(InFlightRequests.summary(later)).toContain('shop.example /slow ×1 (oldest 3.4 s)');
  });

  it('says only how many when nothing is open', () => {
    expect(InFlightRequests.summary()).toBe('In flight 0');
  });

  it('is part of the pool warning, so a full pool names who is in it', () => {
    arrive('scanner.example', '/api/org');
    vi.spyOn(DatabasePoolRegistry, 'snapshots').mockReturnValue([{ name: 'requests', max: 30, total: 30, idle: 0, waiting: 12 }]);
    const log = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
    const watch = new DatabasePoolWatch(log);
    for (let i = 0; i < DatabasePoolWatch.SUSTAINED_SAMPLES; i++) watch.sample(10_000 + i * 500);

    expect(log.warn.mock.calls[0][0]).toContain('In flight 1: scanner.example /api/org ×1');
  });
});
