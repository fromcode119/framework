import { afterEach, describe, expect, it } from 'vitest';
import { ApiWorkers } from '@core/cluster/api-workers';

/**
 * An operator enabled a plugin through api process 1. It waited for api 0 to start the plugin's process —
 * which api 0 never does for a change it did not make — and the request hung, then failed.
 */
describe('which api process starts a plugin process', () => {
  const env = { workers: process.env.API_WORKERS, index: process.env.API_WORKER_INDEX };
  afterEach(() => {
    if (env.workers === undefined) delete process.env.API_WORKERS; else process.env.API_WORKERS = env.workers;
    if (env.index === undefined) delete process.env.API_WORKER_INDEX; else process.env.API_WORKER_INDEX = env.index;
  });

  it('api 0, a single api, and any api process carrying out an operator\'s change', async () => {
    delete process.env.API_WORKERS;
    expect(ApiWorkers.startsPluginProcesses()).toBe(true);
    process.env.API_WORKERS = '4';
    process.env.API_WORKER_INDEX = '0';
    expect(ApiWorkers.startsPluginProcesses()).toBe(true);
    process.env.API_WORKER_INDEX = '2';
    expect(ApiWorkers.startsPluginProcesses()).toBe(false);
    expect(await ApiWorkers.asOperator(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return ApiWorkers.startsPluginProcesses();
    })).toBe(true);
    expect(ApiWorkers.startsPluginProcesses()).toBe(false);
  });
});
