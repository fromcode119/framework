import { afterAll, describe, expect, it } from 'vitest';
import { RedisProcessSignalTransport } from '@core/signals/redis-process-signal-transport';

/**
 * Two transports on a REAL Redis stand in for two api processes: what one publishes, the other hears.
 * SKIPS without `REDIS_TEST_URL`; point it at a throwaway Redis.
 */
const url = process.env.REDIS_TEST_URL;

describe.skipIf(!url)('RedisProcessSignalTransport (real Redis)', () => {
  const namespace = `test-${Date.now()}`;
  const a = url ? new RedisProcessSignalTransport(url, namespace) : null;
  const b = url ? new RedisProcessSignalTransport(url, namespace) : null;
  const other = url ? new RedisProcessSignalTransport(url, `${namespace}-other`) : null;

  afterAll(async () => { await Promise.all([a?.close(), b?.close(), other?.close()]); });

  it('delivers a message from one process to another, and not across namespaces', async () => {
    const heardByB: string[] = [];
    const heardByOther: string[] = [];
    await b!.subscribe((message) => heardByB.push(message));
    await other!.subscribe((message) => heardByOther.push(message));
    await a!.publish('{"signal":"cache-purged"}');
    for (let i = 0; i < 50 && heardByB.length === 0; i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
    expect(heardByB).toEqual(['{"signal":"cache-purged"}']);
    expect(heardByOther).toEqual([]);
  });
});
