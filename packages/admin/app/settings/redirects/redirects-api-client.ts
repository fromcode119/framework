import { ApiPathUtils, SystemConstants } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';

/**
 * The Settings → Redirects surface's API edge — the framework's ONE redirect-rule store
 * (`/system/redirects`, backed by `_system_redirects`). camelCase payloads both ways.
 */
export class RedirectsApiClient {
  /** Composed by the framework, never spelled out here: SystemRouter mounts its admin segments under `/system/admin/*`. */
  private static readonly BASE = SystemConstants.API_PATH.SYSTEM.ADMIN_REDIRECTS;

  /** The one-redirect path, filled from the same declaration rather than concatenated by hand. */
  private static one(id: number): string {
    return ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_REDIRECT, { id });
  }

  static async list(): Promise<Record<string, any>[]> {
    const response = await AdminApi.get(RedirectsApiClient.BASE, { noDedupe: true });
    return Array.isArray(response?.redirects) ? response.redirects : [];
  }

  static async create(input: { fromPath: string; toPath: string; type: string; notes: string }): Promise<Record<string, any>> {
    const response = await AdminApi.post(RedirectsApiClient.BASE, input);
    if (!response?.success) throw new Error(String(response?.error || 'The redirect could not be created.'));
    return response.redirect;
  }

  static async update(id: number, patch: Record<string, any>): Promise<Record<string, any>> {
    const response = await AdminApi.patch(RedirectsApiClient.one(id), patch);
    if (!response?.success) throw new Error(String(response?.error || 'The redirect could not be updated.'));
    return response.redirect;
  }

  static async remove(id: number): Promise<void> {
    const response = await AdminApi.delete(RedirectsApiClient.one(id));
    if (!response?.success) throw new Error(String(response?.error || 'The redirect could not be deleted.'));
  }
}
