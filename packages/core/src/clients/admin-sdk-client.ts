import { ApiPathUtils } from '../api/api-path-utils';
import { AdminGlobalClient } from './admin-global-client';
import { AdminResourceClient } from './admin-resource-client';

export class AdminSdkClient {
  constructor(private readonly baseUrl: string) {}

  static fromServerUrl(serverUrl: string): AdminSdkClient {
    const normalizedServerUrl = String(serverUrl || '').trim().replace(/\/+$/, '');
    return new AdminSdkClient(`${normalizedServerUrl}${ApiPathUtils.adminApiBasePath()}`);
  }

  getGlobal(slug: string): AdminGlobalClient {
    return new AdminGlobalClient(this.baseUrl, slug);
  }

  getCollection(slug: string): AdminResourceClient {
    return new AdminResourceClient(this.baseUrl, slug);
  }
}
