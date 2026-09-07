import { QueueSettings } from '@fromcode119/queue';
import { CoercionUtils } from '@core/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Reads the operator's background-job policy out of `_system_meta`.
 *
 * The policy itself is a value object in `@fromcode119/queue`; only the STORAGE of it is core's
 * business, which is why the reading lives here and the numbers live there.
 */
export class QueueSettingsReader {
  static async read(db: { findOne(table: string, where: Record<string, unknown>): Promise<any> }): Promise<QueueSettings> {
    // `null` when the operator has set nothing — see QueueSettings.from for why that is not `0`.
    const value = async (key: string): Promise<number | null> => {
      const stored = CoercionUtils.toString((await db.findOne(SystemConstants.TABLE.META, { key }))?.value);
      return stored === '' ? null : CoercionUtils.toNumber(stored);
    };

    return QueueSettings.from({
      attempts: await value(SystemConstants.META_KEY.QUEUE_JOB_ATTEMPTS),
      backoffMs: await value(SystemConstants.META_KEY.QUEUE_JOB_BACKOFF_MS),
      keepCompleted: await value(SystemConstants.META_KEY.QUEUE_KEEP_COMPLETED),
      keepFailed: await value(SystemConstants.META_KEY.QUEUE_KEEP_FAILED),
      concurrency: await value(SystemConstants.META_KEY.QUEUE_CONCURRENCY),
    });
  }
}
