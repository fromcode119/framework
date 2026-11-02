import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The usage report rows of {@link SystemSettingDescriptors} — Settings → General. PLATFORM-scoped: one
 * report describes the whole installation. The switch and the address are the operator's; the id and
 * the status are written by the api and only displayed.
 */
export class UsageReportSettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.USAGE_REPORT_ENABLED]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: 'false', description: "Send a daily usage report (versions, number of sites, plugins in use). Off by default; the exact report is shown beside the switch.", group: "General" },
    },
    [SystemConstants.META_KEY.USAGE_REPORT_URL]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.USAGE_REPORT_INSTALL_ID]: { scope: SettingScope.PLATFORM, writable: false, exposed: true },
    [SystemConstants.META_KEY.USAGE_REPORT_STATUS]: { scope: SettingScope.PLATFORM, writable: false, exposed: true },
  };
}
