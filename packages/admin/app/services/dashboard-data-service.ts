import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { PluginHealthPageController } from '@/app/plugins/health/plugin-health-page-controller';
import type { IPluginHealthCounts } from '@/app/plugins/health/interfaces/plugin-health-counts.interface';

/**
 * Fetches and normalizes the admin dashboard datasets. Each method returns the parsed
 * value (or null when unavailable / on error) so the component owns all setState calls
 * and mounted-guards. Logging matches the prior inline implementation.
 */
export class DashboardDataService {
  static async fetchStats(): Promise<any[] | null> {
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.COLLECTIONS);
      if (Array.isArray(data)) {
        // Dynamic sorting based on API-provided priority
        return [...data].sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return (a.name || a.slug).localeCompare(b.name || b.slug);
        });
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);
      return null;
    }
  }

  static async fetchPluginsCount(): Promise<number | null> {
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.ACTIVE);
      if (Array.isArray(data)) {
        return data.length;
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch plugins count:", err);
      return null;
    }
  }

  static async fetchActivity(): Promise<any[] | null> {
    try {
      // Pull from system logs instead of collection audit for "Plugin Activity"
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.LOGS);
      const data = response.docs || response;
      if (Array.isArray(data)) {
        // Map system logs to the UI format
        return data.map(log => ({
          id: log.id,
          title: log.message,
          timestamp: log.timestamp,
          plugin: log.pluginSlug,
          level: log.level
        }));
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch dashboard activity:", err);
      return null;
    }
  }

  /**
   * Plugin registry health counts — the SAME `buildReport` output the api logs at boot
   * ("N active, N held, N error, N inactive"). Returns null on failure so the caller states nothing
   * rather than defaulting to a healthy-looking value.
   *
   * Deliberately NOT `SYSTEM.HEALTH`: that endpoint returns a hardcoded `status: 'ok'` liveness
   * literal, so driving a status line off it would just relocate the fabrication.
   */
  static async fetchPluginHealthCounts(): Promise<IPluginHealthCounts | null> {
    try {
      const report = await PluginHealthPageController.fetchReport();
      return report?.counts ?? null;
    } catch (err) {
      console.error('Failed to fetch plugin health:', err);
      return null;
    }
  }

  static async fetchUpdate(): Promise<any | null> {
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.UPDATE_CHECK);
      if (data && data.hasUpdate) {
        return data;
      }
      return null;
    } catch (err) {
      // Silent fail on dashboard
      return null;
    }
  }
}
