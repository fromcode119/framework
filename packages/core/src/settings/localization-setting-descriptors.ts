import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';
import type { ISystemSettingDescriptor } from '@core/settings/interfaces/system-setting-descriptor.interface';

/**
 * The Localization rows of {@link SystemSettingDescriptors}: locales, the default language per surface,
 * the URL strategy, and the site's region (measurement system, country). Split out because the main table
 * reached the 300-line limit; `SystemSettingDescriptors.ALL` spreads these in, so a key is still declared
 * exactly once and the registry reads one table.
 */
export class LocalizationSettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.LOCALIZATION_LOCALES]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '[{"code":"en","name":"English","enabled":true}]', description: "Available locales.", group: "Localization" },
    },
    [SystemConstants.META_KEY.ENABLED_LOCALES]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'en', description: "Enabled locale codes.", group: "Localization" },
    },
    [SystemConstants.META_KEY.DEFAULT_LOCALE]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'en', description: "Default locale.", group: "Localization" },
    },
    [SystemConstants.META_KEY.FALLBACK_LOCALE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'en', description: "Default admin language.", group: "Localization" },
    },
    [SystemConstants.META_KEY.FRONTEND_DEFAULT_LOCALE]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'en', description: "Default frontend language.", group: "Localization" },
    },
    [SystemConstants.META_KEY.LOCALE_URL_STRATEGY]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'query', description: "Locale URL strategy.", group: "Localization" },
    },
    // Not seeded: blank is a real answer (derive from the frontend language), and a seeded country would
    // be exactly the invented default every module used to hardcode.
    [SystemConstants.META_KEY.COUNTRY]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemConstants.META_KEY.MEASUREMENT_SYSTEM]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'metric', description: "Units for physical dimensions and weight (metric cm/kg | imperial in/lb).", group: "Localization" },
    },
  } satisfies Partial<Record<typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY], ISystemSettingDescriptor>>;
}
