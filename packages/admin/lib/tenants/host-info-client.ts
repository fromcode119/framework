import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * Whose console is this host? Asked BEFORE sign-in (the route is public), so a workspace domain shows
 * its own login and locks its appearance from the first paint. `null` on the shared admin host.
 */
export class HostInfoClient {
  static async workspace(): Promise<{ id: string; slug: string; appearance: string } | null> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.HOST_INFO).catch(() => null);
    const workspace = response?.workspace;
    if (!workspace || typeof workspace !== 'object' || !workspace.id) return null;
    return { id: String(workspace.id), slug: String(workspace.slug || ''), appearance: String(workspace.appearance || '') };
  }
}
