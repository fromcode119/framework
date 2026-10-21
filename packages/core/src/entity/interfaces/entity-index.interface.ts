import type { IIndexWhere } from '@core/collections/interfaces/index-where.interface';

export interface IEntityIndex {
  name?: string;
  fields: string[];
  unique?: boolean;
  where?: IIndexWhere;
}
