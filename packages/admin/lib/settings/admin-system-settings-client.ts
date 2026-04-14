import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';

export class AdminSystemSettingsClient {
  static async getAll(): Promise<Record<string, any>> {
    return AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS);
  }

  static async update(settings: Record<string, any>): Promise<void> {
    await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS, settings);
  }
}