import fs from 'fs';
import { PluginManager, PluginTenantAccess, RequestContextUtils, SystemConstants, TenantResolverService } from '@fromcode119/core';
import { SourcesEvents } from '@fromcode119/sources';
import type { IPackagePublishedEvent, ISitePackagePublisher } from '@fromcode119/sources';

/**
 * The platform half of a source's "Publish builds to site".
 *
 * The package becomes an ordinary file in that site's media library — written inside the site's
 * request scope AND its database scope, so the storage path and the row's `tenant_id` are the site's,
 * exactly as an upload made in that site's console would be — and PACKAGE_PUBLISHED is emitted in the
 * same scope, so only the extensions that site runs hear it. The site's extensions never reach the
 * platform's Sources; the platform reaches the one site the operator named.
 */
export class SitePackagePublisher implements ISitePackagePublisher {
  constructor(private readonly manager: PluginManager) {}

  async isSite(siteId: string): Promise<boolean> {
    const site = await TenantResolverService.shared(this.manager.db as any).resolveById(siteId);
    return Boolean(site?.isActive);
  }

  async publish(siteId: string, archive: { filePath: string; fileName: string }, event: Omit<IPackagePublishedEvent, 'mediaId'>): Promise<string> {
    const db = this.manager.db as any;
    return RequestContextUtils.storage.run({ tenantId: siteId }, () => db.withTenant(siteId, async () => {
      // The gates that decide which plugins hear a hook read this site's set from memory.
      await PluginTenantAccess.warm(siteId);
      const storage = (this.manager.integrations as any).storage;
      const stored = await storage.upload(await fs.promises.readFile(archive.filePath), archive.fileName, { space: 'public' });
      const row = await db.insert(SystemConstants.TABLE.MEDIA, {
        filename: stored.path,
        original_name: archive.fileName,
        mime_type: stored.mimeType,
        file_size: stored.size,
        path: stored.path,
        folder_id: null,
        visibility: 'public',
        provider: stored.provider || storage.provider || 'local',
        integration: 'storage',
      });
      const mediaId = String(row?.id ?? '');
      if (!mediaId) throw new Error('the site\'s media library returned no record for the package');
      this.manager.hooks.emit(SourcesEvents.PACKAGE_PUBLISHED, { ...event, mediaId });
      return mediaId;
    }));
  }
}
