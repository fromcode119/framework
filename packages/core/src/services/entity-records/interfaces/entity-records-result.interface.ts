import type { IEntityRecordRef } from '@core/services/entity-records/interfaces/entity-record-ref.interface';
import type { IEntityRecordAction } from '@core/services/entity-records/interfaces/entity-record-action.interface';
import type { IEntityRecordItem } from '@core/services/entity-records/interfaces/entity-record-item.interface';
import type { IEntityRecordGroup } from '@core/services/entity-records/interfaces/entity-record-group.interface';
import type { IEntityRecordProviderError } from '@core/services/entity-records/interfaces/entity-record-provider-error.interface';

/** The aggregated result for one person reference. */
export interface IEntityRecordsResult {
  ref: IEntityRecordRef;
  items: IEntityRecordItem[];
  groups: IEntityRecordGroup[];
  /** What can be started from the subject, from every provider that answered for it. */
  actions: IEntityRecordAction[];
  providers: string[];
  errors: IEntityRecordProviderError[];
}
