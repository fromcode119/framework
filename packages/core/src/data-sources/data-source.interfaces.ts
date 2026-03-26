export interface LegacyProjection {
  filterKey?: string;
  filterValue?: string;
}

export interface FilterDefinition {
  key: string;
  label: string;
  inputType: 'select' | 'text' | 'number';
  defaultValue?: unknown;
  allowsDynamicOptions?: boolean;
  optionsHint?: string;
  legacyProjection?: LegacyProjection;
}

export interface DatasourceDescriptor {
  pluginSlug: string;
  key: string;
  label: string;
  description?: string;
  collectionFallback?: string;
  defaultPresentation?: 'cards' | 'list';
  hidden?: boolean;
  requiredRoles?: string[];
  filterDefinitions: FilterDefinition[];
}

export interface DatasourceOptionItem {
  value: string;
  label: string;
}

export interface DatasourceOptionsPayload {
  pluginSlug: string;
  key: string;
  filter: string;
  options: DatasourceOptionItem[];
}

export interface DatasourceQueryRequest {
  pluginSlug: string;
  key: string;
  limit?: number;
  sort?: string;
  filters?: Record<string, unknown>;
}

export interface DatasourceQueryResponse {
  source: string;
  limit: number;
  sort: string;
  filterKey?: string;
  filterValue?: string;
}