import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SiteInventory } from '@/lib/tenants/site-inventory';
import { SiteRecord } from '@/lib/tenants/site-record';

/**
 * The admin's client for `/system/admin/tenants`. Every call is a platform-admin call; a 403 here
 * means the account is not one, and the pages show that rather than an empty table.
 */
export class SitesClient {
  private static readonly CHUNK_SIZE_BYTES = 4 * 1024 * 1024;

  static async list(): Promise<{ multiTenant: boolean; sites: SiteRecord[]; inventory: SiteInventory }> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.TENANTS, { noDedupe: true });
    return { multiTenant: response?.multiTenant === true, sites: SiteRecord.fromList(response?.tenants), inventory: SiteInventory.from(response?.installed) };
  }

  static async get(id: string): Promise<SiteRecord> {
    return SiteRecord.from(await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.TENANT(id), { noDedupe: true }));
  }

  static async create(input: Record<string, unknown>): Promise<SiteRecord> {
    return SiteRecord.from(await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.TENANTS, input));
  }

  static async update(id: string, patch: Record<string, unknown>): Promise<SiteRecord> {
    return SiteRecord.from(await AdminApi.patch(AdminConstants.ENDPOINTS.SYSTEM.TENANT(id), patch));
  }

  static async exportSite(id: string): Promise<{ filename: string; rows: number }> {
    const response = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.TENANT_EXPORT(id), {});
    return { filename: String(response?.backup?.filename || ''), rows: Number(response?.manifest?.tables?.reduce?.((sum: number, t: any) => sum + Number(t?.rows || 0), 0) ?? 0) };
  }

  static async remove(id: string, confirmSlug: string): Promise<{ archive: string; files: number; deleted: Record<string, number> }> {
    return AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.TENANT(id), { body: JSON.stringify({ confirmSlug }), headers: { 'Content-Type': 'application/json' } });
  }

  static async addMember(id: string, email: string, roles: string[]): Promise<SiteRecord> {
    return SiteRecord.from(await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.TENANT_MEMBERS(id), { email, roles }));
  }

  static async removeMember(id: string, userId: string): Promise<SiteRecord> {
    return SiteRecord.from(await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.TENANT_MEMBER(id, userId)));
  }

  /** Chunked, like every other archive upload in the admin. Resolves to the upload session id. */
  static async uploadArchive(file: File, onProgress: (percent: number) => void): Promise<string> {
    const estimatedChunks = Math.max(1, Math.ceil(file.size / SitesClient.CHUNK_SIZE_BYTES));
    const session = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.TENANTS_IMPORT_SESSION, {
      originalFilename: file.name, totalSizeBytes: file.size, totalChunks: estimatedChunks,
    }) as { uploadId: string; chunkSizeBytes?: number; totalChunks?: number };
    const chunkSize = Math.max(1, Number(session.chunkSizeBytes || SitesClient.CHUNK_SIZE_BYTES));
    const totalChunks = Math.max(1, Number(session.totalChunks || estimatedChunks));
    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const form = new FormData();
      form.append('chunk', file.slice(start, end), `${file.name}.part-${index}`);
      form.append('uploadId', session.uploadId);
      form.append('chunkIndex', String(index));
      form.append('totalChunks', String(totalChunks));
      await AdminApi.upload(AdminConstants.ENDPOINTS.SYSTEM.TENANTS_IMPORT_CHUNK, form, {
        onProgress: (state) => onProgress(file.size ? Math.min(100, Math.round(((start + state.loadedBytes) / file.size) * 100)) : 100),
      });
    }
    onProgress(100);
    return session.uploadId;
  }

  static async previewImport(uploadId: string, tenant: Record<string, unknown>): Promise<Record<string, any>> {
    return AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.TENANTS_IMPORT_PREVIEW, { uploadId, tenant });
  }

  static async executeImport(uploadId: string, tenant: Record<string, unknown>): Promise<Record<string, any>> {
    return AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.TENANTS_IMPORT_EXECUTE, { uploadId, tenant });
  }

  static async adopt(tenant: Record<string, unknown>): Promise<Record<string, any>> {
    return AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.TENANTS_ADOPT, tenant);
  }
}
