import type { IDatasourceOptionItem } from '@core/data-sources/interfaces/datasource-option-item.interface';

export interface IDatasourceOptionsPayload {
  pluginSlug: string;
  key: string;
  filter: string;
  options: IDatasourceOptionItem[];
}
