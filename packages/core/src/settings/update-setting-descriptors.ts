import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The platform update rows of {@link SystemSettingDescriptors} — Settings → Updates. PLATFORM-scoped:
 * one platform version runs every site. The switch is the operator's; the request and the status are
 * written by the api ("Update now") and the updater's reports, and only displayed.
 */
export class UpdateSettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.FRAMEWORK_AUTO_UPDATE]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: 'true', description: "Install new platform versions automatically. A version marked breaking always waits for the Install button on Settings → Updates.", group: "Updates" },
    },
    [SystemConstants.META_KEY.FRAMEWORK_UPDATE_REQUEST]: { scope: SettingScope.PLATFORM, writable: false, exposed: true },
    [SystemConstants.META_KEY.FRAMEWORK_UPDATE_STATUS]: { scope: SettingScope.PLATFORM, writable: false, exposed: true },
    [SystemConstants.META_KEY.FRAMEWORK_UPDATE_RESTART]: { scope: SettingScope.PLATFORM, writable: false, exposed: true },
    // Marketplace plugins, not the platform: the api checks the catalogue every hour and installs what is newer.
    // A version that asks for a permission nobody approved still waits for the operator (the plugin is held).
    [SystemConstants.META_KEY.PLUGINS_AUTO_UPDATE]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: 'true', description: "Install new versions of marketplace plugins automatically, checked every hour. A version that asks for a new permission always waits for your approval.", group: "Updates" },
    },
    [SystemConstants.META_KEY.PLUGINS_AUTO_UPDATE_STATUS]: { scope: SettingScope.PLATFORM, writable: false, exposed: true },
  };
}
