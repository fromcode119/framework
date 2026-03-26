import { ApiPathUtils } from '../api/api-path-utils';

export class SettingsScopeClient {
  constructor(
    private readonly requester: {
      get: (path: string, options?: any) => Promise<any>;
    },
  ) {}

  frontend(options?: any): Promise<any> {
    return this.requester.get(ApiPathUtils.systemFrontendPath(), options);
  }

  i18n(options?: any): Promise<any> {
    return this.requester.get(ApiPathUtils.systemI18nPath(), options);
  }
}
