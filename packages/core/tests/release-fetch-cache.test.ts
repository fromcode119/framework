import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReleaseFetchCache } from '@core/management/release-fetch-cache';

/** The updater checks every minute; GitHub allows 60 unauthenticated requests an hour per address. */
describe('ReleaseFetchCache', () => {
  afterEach(() => ReleaseFetchCache.clear());

  it('answers from memory for 15 minutes, then asks again', async () => {
    let now = 0;
    const load = vi.fn(async () => ['v0.2.392']);

    await ReleaseFetchCache.remember('tags', load, () => now);
    now = 14 * 60 * 1000;
    await ReleaseFetchCache.remember('tags', load, () => now);
    expect(load).toHaveBeenCalledTimes(1);

    now = 16 * 60 * 1000;
    await ReleaseFetchCache.remember('tags', load, () => now);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('remembers a failure for 5 minutes only, so an unreachable source is retried', async () => {
    let now = 0;
    const load = vi.fn(async () => null);

    expect(await ReleaseFetchCache.remember('tags', load, () => now)).toBeNull();
    now = 4 * 60 * 1000;
    await ReleaseFetchCache.remember('tags', load, () => now);
    expect(load).toHaveBeenCalledTimes(1);

    now = 6 * 60 * 1000;
    await ReleaseFetchCache.remember('tags', load, () => now);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
