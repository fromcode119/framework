import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IPluginHealthReport } from '@/app/plugins/health/interfaces/plugin-health-report.interface';
import type { IPluginReapprovalEntry } from '@/app/plugins/health/interfaces/plugin-reapproval-entry.interface';
/**
 * Data access + business logic for the plugin health page. Hook-free by contract: the page-client
 * class owns React state, lifecycle and notifications; this controller owns "how to fetch/do it".
 */
export class PluginHealthPageController {
  /** Load the registry health report. Throws on transport failure — the caller decides how to react. */
  static async fetchReport(): Promise<IPluginHealthReport | null> {
    const result = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.HEALTH) as IPluginHealthReport;
    return result ?? null;
  }

  /** Re-approve a single held plugin and enable it. */
  static async approveEnable(slug: string): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.TOGGLE(slug), { enabled: true });
  }

  /** Re-approve every held plugin. Returns only the entries that failed. */
  static async reapproveAll(): Promise<IPluginReapprovalEntry[]> {
    const result = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.REAPPROVE_ALL, {}) as {
      reapproved?: IPluginReapprovalEntry[];
    };
    return (result?.reapproved || []).filter((entry) => !entry.ok);
  }

  /** Human-readable summary of a partial re-approval failure. */
  static reapprovalFailureMessage(failed: IPluginReapprovalEntry[]): string {
    return `${failed.length} plugin${failed.length === 1 ? '' : 's'} could not be re-approved.`;
  }
}
