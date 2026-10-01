import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The API response cache row of {@link SystemSettingDescriptors} — Settings → Infrastructure. PLATFORM
 * scoped: it is read from the API's settings cache, per request (ApiResponseCache).
 */
export class ApiResponseCacheSettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.API_RESPONSE_CACHE_SECONDS]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '60', description: "Longest, in seconds, that a kept answer to an anonymous request is served for plugin routes that declare they are the same for every visitor (a published product list). Every change on a site clears it at once; this bounds what no change announces, such as a sale that starts at a set time. 0 = off.", group: "Infrastructure" },
    },
  };
}
