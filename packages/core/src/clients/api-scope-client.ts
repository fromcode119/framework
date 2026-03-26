import { ApiRequestService } from '../api/api-request-service';

export class ApiScopeClient {
  constructor(
    private readonly requester: {
      get: (path: string, options?: any) => Promise<any>;
      post: (path: string, body?: any, options?: any) => Promise<any>;
      put: (path: string, body?: any, options?: any) => Promise<any>;
      patch: (path: string, body?: any, options?: any) => Promise<any>;
      delete: (path: string, options?: any) => Promise<any>;
      getBaseUrl?: () => string;
    },
    private readonly basePath: string,
  ) {}

  get(path = '', options?: any): Promise<any> {
    return this.requester.get(this.buildPath(path), options);
  }

  post(path = '', body?: any, options?: any): Promise<any> {
    return this.requester.post(this.buildPath(path), body, options);
  }

  put(path = '', body?: any, options?: any): Promise<any> {
    return this.requester.put(this.buildPath(path), body, options);
  }

  patch(path = '', body?: any, options?: any): Promise<any> {
    return this.requester.patch(this.buildPath(path), body, options);
  }

  delete(path = '', options?: any): Promise<any> {
    return this.requester.delete(this.buildPath(path), options);
  }

  resolveUrl(path = ''): string {
    const resolvedPath = this.buildPath(path);
    if (typeof this.requester.getBaseUrl !== 'function') {
      return resolvedPath;
    }

    return ApiRequestService.buildUrl(this.requester.getBaseUrl(), resolvedPath);
  }

  private buildPath(path: string): string {
    const normalizedBasePath = String(this.basePath || '').trim().replace(/\/+$/, '');
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath) {
      return normalizedBasePath;
    }

    return `${normalizedBasePath}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
  }
}
