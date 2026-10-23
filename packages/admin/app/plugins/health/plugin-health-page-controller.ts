import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IPluginHealthReport } from '@/app/plugins/health/interfaces/plugin-health-report.interface';
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

  /**
   * Serve the version installed on disk. `restartScheduled` is true when the plugin runs inside the api,
   * which then restarts itself to load the new code; an isolated plugin is swapped in place. `held` is
   * true when the release asks for capabilities that still need the operator's approval.
   */
  static async loadInstalled(slug: string): Promise<{ restartScheduled: boolean; held: boolean }> {
    const result = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.LOAD_INSTALLED(slug), {}) as { restartScheduled?: boolean; held?: boolean };
    return { restartScheduled: result?.restartScheduled === true, held: result?.held === true };
  }
}
