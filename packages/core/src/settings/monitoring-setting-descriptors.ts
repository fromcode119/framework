import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The platform monitoring rows of {@link SystemSettingDescriptors} — Settings → Infrastructure →
 * Monitoring. PLATFORM-scoped: one monitor watches every site, and only the platform admin acts on it.
 * The thresholds are the defaults the admin sees and edits; nothing in code holds a second value.
 */
export class MonitoringSettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.MONITORING_DISK_PERCENT]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '85', description: "Alert when the server's disk is at least this full, in percent. 0 = never.", group: "Infrastructure" },
    },
    [SystemConstants.META_KEY.MONITORING_MEMORY_PERCENT]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '90', description: "Alert when the server's memory is at least this full, in percent. 0 = never.", group: "Infrastructure" },
    },
    [SystemConstants.META_KEY.MONITORING_API_ERROR_PERCENT]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '5', description: "Alert when at least this share of api requests failed with a server error since the last check (every 5 minutes), in percent. 0 = never.", group: "Infrastructure" },
    },
    // Written by the monitor itself; the Health page shows them, nothing edits them.
    [SystemConstants.META_KEY.MONITORING_OPEN_INCIDENTS]: { scope: SettingScope.PLATFORM, writable: false, exposed: false },
    [SystemConstants.META_KEY.MONITORING_SYNCED_TARGETS]: { scope: SettingScope.PLATFORM, writable: false, exposed: false },
  };
}
