import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabasePoolRegistry } from '@fromcode119/database';
import { DatabasePoolWatch } from '@api/server/database-pool-watch';

describe('DatabasePoolWatch', () => {
  afterEach(() => vi.restoreAllMocks());

  const logger = () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }) as any;
  const queued = [
    { name: 'requests', max: 20, total: 20, idle: 0, waiting: 7 },
    { name: 'platform', max: 1, total: 1, idle: 1, waiting: 0 },
  ];

  it('says nothing while no request is queued for a connection', () => {
    vi.spyOn(DatabasePoolRegistry, 'snapshots').mockReturnValue([{ name: 'requests', max: 20, total: 10, idle: 4, waiting: 0 }]);
    const log = logger();
    expect(new DatabasePoolWatch(log).sample(10_000)).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('ignores a pool that is full for a moment — a busy second is not a shortage', () => {
    const snapshots = vi.spyOn(DatabasePoolRegistry, 'snapshots');
    const log = logger();
    const watch = new DatabasePoolWatch(log);
    snapshots.mockReturnValue(queued);
    for (let i = 0; i < DatabasePoolWatch.SUSTAINED_SAMPLES - 1; i++) expect(watch.sample(10_000 + i * 500)).toBeNull();
    snapshots.mockReturnValue([{ ...queued[0], waiting: 0 }, queued[1]]);
    expect(watch.sample(12_000)).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('warns once requests have waited two seconds, with every pool and the setting that sizes it, at most every five seconds', () => {
    vi.spyOn(DatabasePoolRegistry, 'snapshots').mockReturnValue(queued);
    const log = logger();
    const watch = new DatabasePoolWatch(log);
    let line: string | null = null;
    for (let i = 0; i < DatabasePoolWatch.SUSTAINED_SAMPLES; i++) line = watch.sample(10_000 + i * 500);
    expect(line).toBe('requests: 7 waiting, 20 of 20 open, 0 idle; platform: 0 waiting, 1 of 1 open, 1 idle');
    expect(log.warn.mock.calls[0][0]).toContain('Settings → Infrastructure → Database connections');
    expect(watch.sample(13_000)).toBeNull();
    expect(watch.sample(17_000)).not.toBeNull();
    expect(log.warn).toHaveBeenCalledTimes(2);
  });
});
