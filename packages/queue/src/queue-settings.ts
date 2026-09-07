/**
 * The operator's background-job policy, and the defaults that apply until they set one.
 *
 * A pure value object: it holds no database and reads no environment, because the queue package must
 * not depend on core (core depends on IT). Core reads the stored values from `_system_meta` and hands
 * an instance over — see `QueueSettingsReader`.
 *
 * These numbers existed nowhere before: a job that threw was gone after one attempt, nothing logged it,
 * and every completed job stayed in Redis for ever. Those are policy decisions an operator should be
 * able to see and change, not constants buried in an adapter.
 */
export class QueueSettings {
  static readonly ATTEMPTS_DEFAULT = 3;
  static readonly BACKOFF_MS_DEFAULT = 5_000;
  static readonly KEEP_COMPLETED_DEFAULT = 100;
  static readonly KEEP_FAILED_DEFAULT = 500;
  static readonly CONCURRENCY_DEFAULT = 1;

  constructor(
    readonly attempts: number,
    readonly backoffMs: number,
    readonly keepCompleted: number,
    readonly keepFailed: number,
    readonly concurrency: number,
  ) {}

  static defaults(): QueueSettings {
    return new QueueSettings(
      QueueSettings.ATTEMPTS_DEFAULT,
      QueueSettings.BACKOFF_MS_DEFAULT,
      QueueSettings.KEEP_COMPLETED_DEFAULT,
      QueueSettings.KEEP_FAILED_DEFAULT,
      QueueSettings.CONCURRENCY_DEFAULT,
    );
  }

  /**
   * Builds an instance from values that may be absent.
   *
   * `null` means the operator has set nothing. Distinguishing that from a stored `0` matters: for
   * retention, zero means "keep nothing" and is a real answer, while absent means "use the default".
   * Collapsing both to 0 silently turned every unset retention into "discard everything".
   */
  static from(stored: {
    attempts: number | null;
    backoffMs: number | null;
    keepCompleted: number | null;
    keepFailed: number | null;
    concurrency: number | null;
  }): QueueSettings {
    // Attempts, backoff and concurrency below 1 would stop work happening at all, so those need a
    // positive value; retention accepts 0 because "keep nothing" is a choice.
    const positive = (read: number | null, fallback: number) => (read !== null && read > 0 ? read : fallback);
    const retention = (read: number | null, fallback: number) => (read !== null && read >= 0 ? read : fallback);

    return new QueueSettings(
      positive(stored.attempts, QueueSettings.ATTEMPTS_DEFAULT),
      positive(stored.backoffMs, QueueSettings.BACKOFF_MS_DEFAULT),
      retention(stored.keepCompleted, QueueSettings.KEEP_COMPLETED_DEFAULT),
      retention(stored.keepFailed, QueueSettings.KEEP_FAILED_DEFAULT),
      positive(stored.concurrency, QueueSettings.CONCURRENCY_DEFAULT),
    );
  }

  /**
   * What every enqueued job gets unless the caller says otherwise. The caller's own options win, so a
   * job that genuinely must not be retried can still say `attempts: 1`.
   */
  jobOptions(): Record<string, unknown> {
    return {
      attempts: this.attempts,
      backoff: { type: 'exponential', delay: this.backoffMs },
      removeOnComplete: this.keepCompleted,
      removeOnFail: this.keepFailed,
    };
  }
}
