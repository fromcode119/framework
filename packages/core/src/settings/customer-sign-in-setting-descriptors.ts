import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The customer sign-in and sign-up rows of {@link SystemSettingDescriptors} — Settings → General →
 * Frontend Auth. SITE-scoped: each site decides who may sign in and sign up, on its website and in the
 * apps it serves.
 */
export class CustomerSignInSettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'true', description: "Enable frontend auth flows.", group: "security" },
    },
    [SystemConstants.META_KEY.FRONTEND_REGISTRATION_ENABLED]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'true', description: "Allow new customer self-registration.", group: "security" },
    },
    // The same two switches for every request that is not the site's website — a native app the site
    // serves. They are separate because a site may close its website and still sign people up in its
    // app, and they exist at all so that no client can step around the site's choice by calling itself
    // something other than the website.
    [SystemConstants.META_KEY.APP_AUTH_ENABLED]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'true', description: "Enable sign-in flows for apps this site serves.", group: "security" },
    },
    [SystemConstants.META_KEY.APP_REGISTRATION_ENABLED]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'true', description: "Allow new customers to register from apps this site serves.", group: "security" },
    },
  };
}
