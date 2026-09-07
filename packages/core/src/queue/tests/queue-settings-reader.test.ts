import { describe, expect, it } from 'vitest';
import { QueueSettings } from '@fromcode119/queue';
import { QueueSettingsReader } from '@core/queue/queue-settings-reader';
import { SystemConstants } from '@core/constants/system.constants';

class MetaFixture {
  constructor(private readonly stored: Record<string, unknown>) {}
  async findOne(_table: string, where: Record<string, unknown>): Promise<{ value: unknown } | null> {
    const key = String(where.key);
    return key in this.stored ? { value: this.stored[key] } : null;
  }
}

describe('QueueSettingsReader', () => {
  it('gives every job retries, backoff and a retention limit — none of which existed before', async () => {
    const settings = await QueueSettingsReader.read(new MetaFixture({}) as any);
    expect(settings.attempts).toBe(QueueSettings.ATTEMPTS_DEFAULT);

    const options = settings.jobOptions();
    expect(options.attempts).toBe(3);
    expect(options.backoff).toEqual({ type: 'exponential', delay: QueueSettings.BACKOFF_MS_DEFAULT });
    // Without these two, every finished job stayed in Redis for ever.
    expect(options.removeOnComplete).toBe(QueueSettings.KEEP_COMPLETED_DEFAULT);
    expect(options.removeOnFail).toBe(QueueSettings.KEEP_FAILED_DEFAULT);
  });

  it('reads what the operator stored', async () => {
    const settings = await QueueSettingsReader.read(new MetaFixture({
      [SystemConstants.META_KEY.QUEUE_JOB_ATTEMPTS]: '5',
      [SystemConstants.META_KEY.QUEUE_CONCURRENCY]: '4',
    }) as any);

    expect(settings.attempts).toBe(5);
    expect(settings.concurrency).toBe(4);
    expect(settings.backoffMs).toBe(QueueSettings.BACKOFF_MS_DEFAULT);
  });

  it('lets retention be zero — "keep nothing" is a real answer', async () => {
    const settings = await QueueSettingsReader.read(new MetaFixture({
      [SystemConstants.META_KEY.QUEUE_KEEP_COMPLETED]: '0',
    }) as any);
    expect(settings.keepCompleted).toBe(0);
  });

  it('refuses a value that would stop work happening at all', async () => {
    const settings = await QueueSettingsReader.read(new MetaFixture({
      [SystemConstants.META_KEY.QUEUE_JOB_ATTEMPTS]: '0',
      [SystemConstants.META_KEY.QUEUE_CONCURRENCY]: '-2',
    }) as any);
    expect(settings.attempts).toBe(QueueSettings.ATTEMPTS_DEFAULT);
    expect(settings.concurrency).toBe(QueueSettings.CONCURRENCY_DEFAULT);
  });
});
