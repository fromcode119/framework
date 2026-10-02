import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerMaintenanceService } from '@api/server/server-maintenance-service';

/**
 * Every request asks whether the site is in maintenance, and each answer was a Redis round trip. Within
 * `STATUS_REUSE_MS` requests share one lookup; after it the flag is read again.
 */
function service(value: string) {
  const cache = { get: vi.fn(async () => value), set: vi.fn() };
  const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { cache, maintenance: new ServerMaintenanceService({ db: {} } as any, cache as any, new Map(), logger as any) };
}

afterEach(() => vi.useRealTimers());

describe('ServerMaintenanceService.getStatus', () => {
  it('requests arriving together share one lookup', async () => {
    const { cache, maintenance } = service('false');
    const answers = await Promise.all(Array.from({ length: 50 }, () => maintenance.getStatus()));
    expect(new Set(answers)).toEqual(new Set([false]));
    expect(cache.get).toHaveBeenCalledTimes(1);
  });

  it('a switch made elsewhere is seen once the reuse window has passed', async () => {
    vi.useFakeTimers();
    const { cache, maintenance } = service('false');
    expect(await maintenance.getStatus()).toBe(false);
    cache.get.mockResolvedValue('true');
    expect(await maintenance.getStatus()).toBe(false);
    vi.advanceTimersByTime(ServerMaintenanceService.STATUS_REUSE_MS);
    expect(await maintenance.getStatus()).toBe(true);
    expect(cache.get).toHaveBeenCalledTimes(2);
  });

  it('still fails closed when the flag cannot be read', async () => {
    const { cache, maintenance } = service('false');
    cache.get.mockRejectedValue(new Error('redis down'));
    expect(await maintenance.getStatus()).toBe(true);
  });
});
