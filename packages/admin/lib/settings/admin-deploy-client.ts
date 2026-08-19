import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminDeployApp } from '@/lib/settings/admin-deploy-app';

/**
 * Restart controls, talking to the framework's `/system/deploy/*` endpoints.
 *
 * The app list is READ from the api rather than written here: which apps exist, where this install
 * would reach them, and whether the shared internal secret is configured are all facts the server
 * holds. A hardcoded list in the admin would go on offering a button after the deployment stopped
 * being able to honour it.
 */
export class AdminDeployClient {
  static async listApps(): Promise<{ apps: AdminDeployApp[]; secretConfigured: boolean; secretEnvKey: string }> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.DEPLOY_APPS);
    return {
      apps: (Array.isArray(response?.apps) ? response.apps : []).map(AdminDeployApp.from),
      secretConfigured: response?.secretConfigured === true,
      secretEnvKey: String(response?.secretEnvKey || ''),
    };
  }

  /**
   * Ask for one app to restart. Resolves only when the api confirmed the exit was scheduled; a refusal
   * arrives as a thrown error carrying the api's stated reason.
   */
  static async restart(app: string): Promise<{ exitInMs: number }> {
    const response = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.DEPLOY_RESTART, { app });
    return { exitInMs: Number(response?.exitInMs) || 0 };
  }
}
