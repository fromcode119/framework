import { describe, expect, it } from 'vitest';
import { QueueSettings } from '@queue/queue-settings';

describe('QueueSettings', () => {
  it('falls back to the declared defaults when the operator has set nothing', () => {
    const settings = QueueSettings.from({
      attempts: null, backoffMs: null, keepCompleted: null, keepFailed: null, concurrency: null,
    });
    expect(settings).toEqual(QueueSettings.defaults());
    expect(settings.attempts).toBe(QueueSettings.ATTEMPTS_DEFAULT);
  });

  it('keeps a stored 0 for retention — "keep nothing" is a real answer', () => {
    const settings = QueueSettings.from({
      attempts: null, backoffMs: null, keepCompleted: 0, keepFailed: 0, concurrency: null,
    });
    expect(settings.keepCompleted).toBe(0);
    expect(settings.keepFailed).toBe(0);
  });

  it('refuses a value that would stop work happening at all', () => {
    const settings = QueueSettings.from({
      attempts: 0, backoffMs: 0, keepCompleted: null, keepFailed: null, concurrency: -2,
    });
    expect(settings.attempts).toBe(QueueSettings.ATTEMPTS_DEFAULT);
    expect(settings.backoffMs).toBe(QueueSettings.BACKOFF_MS_DEFAULT);
    expect(settings.concurrency).toBe(QueueSettings.CONCURRENCY_DEFAULT);
  });

  it('describes every job it enqueues', () => {
    const options = QueueSettings.from({
      attempts: 5, backoffMs: 250, keepCompleted: 10, keepFailed: 20, concurrency: 4,
    }).jobOptions();
    expect(options).toEqual({
      attempts: 5,
      backoff: { type: 'exponential', delay: 250 },
      removeOnComplete: 10,
      removeOnFail: 20,
    });
  });
});
