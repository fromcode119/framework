import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabasePoolRegistry } from '@fromcode119/database';
import { DatabasePoolWatch } from '@api/server/database-pool-watch';

describe('DatabasePoolWatch', () => {
  afterEach(() => vi.restoreAllMocks());

  const logger = () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }) as any;

  it('says nothing while no request is queued for a connection', () => {
    vi.spyOn(DatabasePoolRegistry, 'snapshots').mockReturnValue([{ name: 'requests', total: 10, idle: 4, waiting: 0 }]);
    const log = logger();
    expect(new DatabasePoolWatch(log).sample(10_000)).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('warns with every pool\'s counters when one has requests waiting, at most every five seconds', () => {
    vi.spyOn(DatabasePoolRegistry, 'snapshots').mockReturnValue([
      { name: 'requests', total: 10, idle: 0, waiting: 7 },
      { name: 'platform', total: 1, idle: 1, waiting: 0 },
    ]);
    const log = logger();
    const watch = new DatabasePoolWatch(log);
    expect(watch.sample(10_000)).toBe('requests: 7 waiting, 10 open, 0 idle; platform: 0 waiting, 1 open, 1 idle');
    expect(watch.sample(12_000)).toBeNull();
    expect(watch.sample(15_000)).not.toBeNull();
    expect(log.warn).toHaveBeenCalledTimes(2);
  });
});
