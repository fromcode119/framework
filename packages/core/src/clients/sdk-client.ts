import { ApiPathUtils } from '../api/api-path-utils';
import { AdminUserClient } from './admin-user-client';
import { ApiScopeClient } from './api-scope-client';
import { BrowserStateClient } from './browser-state-client';
import { CollectionScopeClient } from './collection-scope-client';
import { SettingsScopeClient } from './settings-scope-client';
import { SystemAuthClient } from './system-auth-client';
import { SystemAuthSession } from './system-auth-session';

export class SdkClient {
  constructor(
    private readonly requester: {
      get: (path: string, options?: any) => Promise<any>;
      post: (path: string, body?: any, options?: any) => Promise<any>;
      put: (path: string, body?: any, options?: any) => Promise<any>;
      patch: (path: string, body?: any, options?: any) => Promise<any>;
      delete: (path: string, options?: any) => Promise<any>;
      getBaseUrl?: () => string;
    },
  ) {}

  getAuth(): ApiScopeClient {
    return new ApiScopeClient(this.requester, ApiPathUtils.authPath());
  }

  getSystemAuth(): SystemAuthClient {
    return new SystemAuthClient(this.requester);
  }

  getSystemAuthSession(): SystemAuthSession {
    return new SystemAuthSession();
  }

  getBrowserState(): BrowserStateClient {
    return new BrowserStateClient();
  }

  getSystem(): ApiScopeClient {
    return new ApiScopeClient(this.requester, ApiPathUtils.systemPath());
  }

  getAdminUsers(): AdminUserClient {
    return new AdminUserClient(this.requester);
  }

  getPlugin(slug: string): ApiScopeClient {
    return new ApiScopeClient(this.requester, ApiPathUtils.pluginPath(slug));
  }

  getTheme(slug: string): ApiScopeClient {
    return new ApiScopeClient(this.requester, ApiPathUtils.themePath(slug));
  }

  getCollection(slug: string): CollectionScopeClient {
    return new CollectionScopeClient(this.requester, slug);
  }

  getSettings(): SettingsScopeClient {
    return new SettingsScopeClient(this.requester);
  }
}
