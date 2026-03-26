import { ApiPathUtils } from '../api/api-path-utils';
import { ApiRequestService } from '../api/api-request-service';

export class AdminGlobalClient {
  constructor(
    private readonly baseUrl: string,
    private readonly globalSlug: string,
  ) {}

  read(params?: Record<string, any>, options?: RequestInit): Promise<any> {
    return ApiRequestService.getJson(this.baseUrl, this.buildPath(params), options);
  }

  readOrFallback(fallback: any, params?: Record<string, any>, options?: RequestInit): Promise<any> {
    return ApiRequestService.getJsonOrFallback(this.baseUrl, this.buildPath(params), fallback, options);
  }

  private buildPath(params?: Record<string, any>): string {
    const normalizedSlug = String(this.globalSlug || '').trim().replace(/^\/+|\/+$/g, '');
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      search.set(key, String(value));
    }

    const query = search.toString();
    const path = ApiPathUtils.adminGlobalPath(normalizedSlug);
    return query ? `${path}?${query}` : path;
  }
}
