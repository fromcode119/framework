import { ApiPathUtils } from '../api/api-path-utils';
import { ApiRequestService } from '../api/api-request-service';

export class AdminResourceClient {
  constructor(
    private readonly baseUrl: string,
    private readonly resourceSlug: string,
  ) {}

  list(params?: Record<string, any>, options?: RequestInit): Promise<any> {
    return ApiRequestService.getJson(this.baseUrl, this.buildPath(params), options);
  }

  private buildPath(params?: Record<string, any>): string {
    const normalizedSlug = String(this.resourceSlug || '').trim().replace(/^\/+|\/+$/g, '');
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      search.set(key, String(value));
    }

    const query = search.toString();
    const path = ApiPathUtils.adminCollectionPath(normalizedSlug);
    return query ? `${path}?${query}` : path;
  }
}
