import type { IEntityRecordItem } from '@core/services/entity-records/interfaces/entity-record-item.interface';

/** Records sharing one display bucket. */
export interface IEntityRecordGroup {
  group: string;
  items: IEntityRecordItem[];
}
