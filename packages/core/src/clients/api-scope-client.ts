import { ApiRequestService } from '@core/api/api-request-service';
import type { IApiDownloadOptions } from '@core/clients/interfaces/api-download-options.interface';

export class ApiScopeClient {
  constructor(
    private readonly requester: {
      get: (path: string, options?: any) => Promise<any>;
      post: (path: string, body?: any, options?: any) => Promise<any>;
      put: (path: string, body?: any, options?: any) => Promise<any>;
      patch: (path: string, body?: any, options?: any) => Promise<any>;
      delete: (path: string, options?: any) => Promise<any>;
      getBaseUrl?: () => string;
      /** Saves a file the api answers with — the surfaces that can (the console) provide it. */
      download?: (path: string, options?: IApiDownloadOptions) => Promise<void>;
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

  /**
   * Saves a file this api hands out, sent as this surface's own requests are — a plain link loses
   * that, and a private site's console then reads as a stranger. Refused where the surface cannot.
   */
  download(path = '', options?: IApiDownloadOptions): Promise<void> {
    if (!this.requester.download) return Promise.reject(new Error('This surface cannot download files.'));
    return this.requester.download(this.buildPath(path), options);
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
