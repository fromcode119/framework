import { DatasourceLayout } from '@core/data-sources/enums/datasource-layout.enum';
import type { IFilterDefinition } from '@core/data-sources/interfaces/filter-definition.interface';

export interface IDatasourceDescriptor {
  pluginSlug: string;
  key: string;
  label: string;
  description?: string;
  collectionFallback?: string;
  defaultPresentation?: DatasourceLayout;
  hidden?: boolean;
  requiredRoles?: string[];
  filterDefinitions: IFilterDefinition[];
}
