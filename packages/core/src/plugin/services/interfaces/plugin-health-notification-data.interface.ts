import type { IPluginHealthNotificationEntry } from '@core/plugin/services/interfaces/plugin-health-notification-entry.interface';

export interface IPluginHealthNotificationData {
  count: number;
  plugins: IPluginHealthNotificationEntry[];
}
