import { MediaPickerSourceService } from '@/components/media/media-picker-source-service';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { MediaRelationFieldUtils } from '@/components/collection/media-relation-field-utils';
import type { IMediaRelationPreview } from '@/components/collection/interfaces/media-relation-preview.interface';

/** What a stored media selection is — its file's address, name and type — for a field or a list cell to show. */
export class MediaRelationPreviewResolver {
  static async resolve(id: string): Promise<IMediaRelationPreview | null> {
    // A theme-asset selection ("theme:<relativePath>") is not a media record — resolve its preview
    // from the active theme's asset listing instead of the media collection.
    if (id.startsWith('theme:')) {
      const match = (await MediaPickerSourceService.fetchThemeAssets()).find((item) => item.id === id);
      return match ? { id, url: match.url, filename: match.filename, mimeType: match.mimeType } : null;
    }
    // The media API, not the generic collection record: only it addresses the file on the SITE's host.
    // A site's uploads live in its own directory and are served per host, so a bare `path` resolved
    // against the console's host 404s for every file uploaded since sites got their own directories.
    try {
      const response = await AdminApi.get(`${AdminConstants.ENDPOINTS.MEDIA.BASE}?id=${encodeURIComponent(id)}&limit=1`);
      const docs = Array.isArray(response) ? response : Array.isArray(response?.docs) ? response.docs : [];
      const doc = docs[0];
      const url = doc?.url ? MediaRelationFieldUtils.resolvePreviewUrl(String(doc.url)) : '';
      return url ? { id, url, filename: String(doc.originalName || doc.filename || `media-${id}`), mimeType: String(doc.mimeType || '') } : null;
    } catch {
      return null;
    }
  }
}
