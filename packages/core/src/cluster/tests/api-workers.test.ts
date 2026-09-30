import { afterEach, describe, expect, it } from 'vitest';
import { ApiWorkers } from '@core/cluster/api-workers';
import { RateLimiter } from '@core/security/rate-limiter';

describe('ApiWorkers', () => {
  afterEach(() => { delete process.env.API_WORKERS; delete process.env.API_WORKER_INDEX; });

  it('is one worker unless API_WORKERS says more', () => {
    expect(ApiWorkers.count()).toBe(1);
    process.env.API_WORKERS = 'nonsense';
    expect(ApiWorkers.count()).toBe(1);
    process.env.API_WORKERS = '4';
    expect(ApiWorkers.count()).toBe(4);
    expect(ApiWorkers.isMultiProcess()).toBe(true);
  });

  it('splits a limit between workers, never below one, and leaves "unlimited" alone', () => {
    process.env.API_WORKERS = '4';
    expect(ApiWorkers.share(100)).toBe(25);
    expect(ApiWorkers.share(3)).toBe(1);
    expect(ApiWorkers.share(0)).toBe(0);
    delete process.env.API_WORKERS;
    expect(ApiWorkers.share(100)).toBe(100);
  });

  it('a per-process RateLimiter enforces this worker\'s share', () => {
    process.env.API_WORKERS = '2';
    const limiter = new RateLimiter(10, 60_000);
    const allowed = Array.from({ length: 8 }, () => limiter.check('k')).filter(Boolean).length;
    expect(allowed).toBe(5);
  });

  it('is the first worker unless API_WORKER_INDEX names a later one', () => {
    expect(ApiWorkers.isFirstWorker()).toBe(true);
    process.env.API_WORKER_INDEX = '0';
    expect(ApiWorkers.isFirstWorker()).toBe(true);
    process.env.API_WORKER_INDEX = '3';
    expect(ApiWorkers.index()).toBe(3);
    expect(ApiWorkers.isFirstWorker()).toBe(false);
  });
});
