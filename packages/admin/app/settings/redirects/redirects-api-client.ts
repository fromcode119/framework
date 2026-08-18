import { AdminApi } from '@/lib/api';

/**
 * The Settings → Redirects surface's API edge — the framework's ONE redirect-rule store
 * (`/system/redirects`, backed by `_system_redirects`). camelCase payloads both ways.
 */
export class RedirectsApiClient {
  /** SystemRouter admin segments mount under `/system/admin/*` (same as `/system/admin/settings`). */
  private static readonly BASE = '/system/admin/redirects';

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
    const response = await AdminApi.patch(`${RedirectsApiClient.BASE}/${id}`, patch);
    if (!response?.success) throw new Error(String(response?.error || 'The redirect could not be updated.'));
    return response.redirect;
  }

  static async remove(id: number): Promise<void> {
    const response = await AdminApi.delete(`${RedirectsApiClient.BASE}/${id}`);
    if (!response?.success) throw new Error(String(response?.error || 'The redirect could not be deleted.'));
  }
}
