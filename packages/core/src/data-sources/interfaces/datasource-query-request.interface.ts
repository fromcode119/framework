export interface IDatasourceQueryRequest {
  pluginSlug: string;
  key: string;
  limit?: number;
  sort?: string;
  filters?: Record<string, unknown>;
}
