import type { IEntityRecordRef } from '@core/services/entity-records/interfaces/entity-record-ref.interface';
import type { IEntityRecordItem } from '@core/services/entity-records/interfaces/entity-record-item.interface';

/** What a plugin passes to context.entityRecords.registerProvider(). */
export interface IEntityRecordProviderRegistration {
  namespace: string;
  pluginSlug: string;
  /** Provider key, unique within the plugin, e.g. 'invoices'. */
  key: string;
  /** Human label for the provider's records, used as a default group label. */
  label: string;
  /** Resolve the records this provider owns for the given person. */
  resolve: (ref: IEntityRecordRef) => Promise<IEntityRecordItem[]>;
}
