import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IDashboardLayoutEntry } from '@/lib/dashboard/interfaces/dashboard-layout-entry.interface';

/**
 * Where a person's dashboard layout is kept: their own UI preferences on the server, so it follows
 * them to another browser. Preferences are stored per site, so each site has its own dashboard.
 */
export class DashboardLayoutStore {
  private static readonly KEY = 'dashboard.layout';

  /** The saved layout, or null when this person has never arranged their dashboard. */
  static async load(): Promise<IDashboardLayoutEntry[] | null> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PREFERENCE(DashboardLayoutStore.KEY));
    const value = response?.value;
    return Array.isArray(value?.widgets) ? value.widgets : null;
  }

  static async save(widgets: IDashboardLayoutEntry[]): Promise<void> {
    await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.PREFERENCE(DashboardLayoutStore.KEY), { value: { widgets } });
  }

  /** Forget the arrangement, so the dashboard shows the defaults again. */
  static async reset(): Promise<void> {
    await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.PREFERENCE(DashboardLayoutStore.KEY), { value: null });
  }
}
