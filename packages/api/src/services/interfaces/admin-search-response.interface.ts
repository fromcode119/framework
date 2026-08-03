import type { IAdminSearchResult } from '@api/services/interfaces/admin-search-result.interface';

export interface IAdminSearchResponse {
  query: string;
  results: IAdminSearchResult[];
}
