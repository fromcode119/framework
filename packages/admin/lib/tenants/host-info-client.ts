import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * Whose console is this host? Asked BEFORE sign-in (the route is public), so a workspace domain shows
 * its own login and locks its appearance from the first paint. `null` on the shared admin host.
 */
export class HostInfoClient {
  /**
   * The sign-in asks for the workspace and the platform name at the same moment; they share one
   * request. Kept only briefly, so a console that changes its appearance later still asks again.
   */
  private static readonly SHARE_MS = 5_000;
  private static pending: Promise<any> | null = null;
  private static askedAt = 0;

  private static fetch(): Promise<any> {
    if (!HostInfoClient.pending || Date.now() - HostInfoClient.askedAt > HostInfoClient.SHARE_MS) {
      HostInfoClient.askedAt = Date.now();
      HostInfoClient.pending = AdminApi.get(AdminConstants.ENDPOINTS.AUTH.HOST_INFO).catch(() => {
        HostInfoClient.pending = null;
        return null;
      });
    }
    return HostInfoClient.pending;
  }

  static async workspace(): Promise<{ id: string; slug: string; appearance: string } | null> {
    const response = await HostInfoClient.fetch();
    const workspace = response?.workspace;
    if (!workspace || typeof workspace !== 'object' || !workspace.id) return null;
    return { id: String(workspace.id), slug: String(workspace.slug || ''), appearance: String(workspace.appearance || '') };
  }

  /** Settings → General → Platform name, or '' when the operator left it empty. */
  static async platformName(): Promise<string> {
    const response = await HostInfoClient.fetch();
    return String(response?.platformName ?? '').trim();
  }
}
