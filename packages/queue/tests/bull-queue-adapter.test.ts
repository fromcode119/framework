import { describe, it, expect, afterEach } from 'vitest';
import { BullQueueAdapter } from '@queue/adapters/bull-queue-adapter';
import { QueueSettings } from '@queue/queue-settings';

/**
 * The Bull adapter against a REAL Redis, because the three things it exists for — a job surviving the
 * process that enqueued it, a failed job being retried, and a failure being audible — are all properties
 * of the broker, not of the class. A mocked bullmq would assert nothing.
 *
 * Point QUEUE_TEST_REDIS_URL at a throwaway Redis to run it; without one the suite skips rather than
 * inventing a pass.
 */
const REDIS_URL = process.env.QUEUE_TEST_REDIS_URL || '';
const describeWithRedis = REDIS_URL ? describe : describe.skip;

describeWithRedis('BullQueueAdapter (integration)', () => {
  const adapters: BullQueueAdapter[] = [];

  const adapter = async (overrides: Partial<Record<'attempts' | 'backoffMs', number>> = {}) => {
    const settings = QueueSettings.from({
      attempts: overrides.attempts ?? null,
      backoffMs: overrides.backoffMs ?? null,
      keepCompleted: null,
      keepFailed: null,
      concurrency: null,
    });
    const failures: Array<{ queue: string; error: string }> = [];
    const created = new BullQueueAdapter(REDIS_URL, `test-${Date.now()}-${adapters.length}`, settings, (queue, _id, error) => {
      failures.push({ queue, error: error?.message || String(error) });
    });
    adapters.push(created);
    return { created, failures };
  };

  const waitFor = async (condition: () => boolean, timeoutMs = 15_000) => {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
      if (Date.now() > deadline) return false;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return true;
  };

  afterEach(async () => {
    await Promise.all(adapters.splice(0).map(a => a.close()));
  });

  it('delivers an enqueued job to the registered worker', async () => {
    const { created } = await adapter();
    const seen: any[] = [];
    created.registerWorker('jobs', async (job: any) => { seen.push(job.data); });

    await created.addJob('jobs', 'greet', { who: 'operator' });

    expect(await waitFor(() => seen.length === 1)).toBe(true);
    expect(seen[0]).toEqual({ who: 'operator' });
  });

  it('retries a throwing job for the configured number of attempts and reports the failure', async () => {
    const { created, failures } = await adapter({ attempts: 3, backoffMs: 10 });
    let calls = 0;
    created.registerWorker('jobs', async () => { calls += 1; throw new Error('nope'); });

    await created.addJob('jobs', 'explode', {});

    expect(await waitFor(() => calls >= 3)).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(calls).toBe(3);
    // One event per ATTEMPT, not one per exhausted job — the operator sees three lines for one bad job.
    expect(failures).toEqual([
      { queue: 'jobs', error: 'nope' },
      { queue: 'jobs', error: 'nope' },
      { queue: 'jobs', error: 'nope' },
    ]);
  });

  it("lets a caller's own options override the operator's policy", async () => {
    const { created, failures } = await adapter({ attempts: 3, backoffMs: 10 });
    let calls = 0;
    created.registerWorker('jobs', async () => { calls += 1; throw new Error('once only'); });

    await created.addJob('jobs', 'explode', {}, { attempts: 1 });

    expect(await waitFor(() => failures.length > 0)).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(calls).toBe(1);
  });

  it('refuses a second worker on the same queue', async () => {
    const { created } = await adapter();
    created.registerWorker('jobs', async () => {});
    expect(() => created.registerWorker('jobs', async () => {})).toThrow(/already registered/);
  });
});
