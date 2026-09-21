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
  /**
   * Correlation keys this provider understands (`['orderNumber']`). A provider that declares them
   * answers SUBJECT refs offering at least one, and is never asked about a person. A provider that
   * declares none is a PERSON provider and only ever sees person refs — which is what every provider
   * written before subjects existed is, so omitting this keeps that behaviour exactly.
   */
  matchKeys?: string[];
  /** Resolve the records this provider owns for the given person or subject. */
  resolve: (ref: IEntityRecordRef) => Promise<IEntityRecordItem[]>;
}
