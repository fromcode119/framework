export interface IDatasourceQueryResponse {
  source: string;
  limit: number;
  sort: string;
  filterKey?: string;
  filterValue?: string;
}
