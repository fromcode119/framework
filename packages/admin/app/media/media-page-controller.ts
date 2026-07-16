import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import type { MediaFolder, MediaItem, MediaLibraryPage, MovingItem } from './media-page.interfaces';

/**
 * Data access + business logic for the media library. Hook-free by contract: the page-client class
 * owns React state and lifecycle; this controller owns "how to fetch/do it".
 */
export class MediaPageController {
  private static get base(): string {
    return AdminConstants.ENDPOINTS.MEDIA.BASE;
  }

  /**
   * Items + folders for a folder/search view. With no folder and no query the listing is pinned to
   * the root (`folderId=null`); a search deliberately spans every folder.
   */
  static async fetchLibrary(currentFolderId: number | null, searchQuery: string): Promise<MediaLibraryPage> {
    const q = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : '';
    const f = currentFolderId !== null ? `&folderId=${currentFolderId}` : (searchQuery ? '' : '&folderId=null');

    const [items, folders] = await Promise.all([
      AdminApi.get(`${MediaPageController.base}?${q}${f}`),
      AdminApi.get(`${MediaPageController.base}/folders?parentId=${currentFolderId || 'null'}`),
    ]);

    return { items, folders };
  }

  /** Breadcrumb trail for a folder. The root has no trail. */
  static async fetchFolderPath(currentFolderId: number | null): Promise<MediaFolder[]> {
    if (!currentFolderId) return [];
    return AdminApi.get(`${MediaPageController.base}/folders/${currentFolderId}/path`);
  }

  static async createFolder(name: string, parentId: number | null): Promise<void> {
    await AdminApi.post(`${MediaPageController.base}/folders`, { name, parentId });
  }

  static async renameFolder(folderId: number, name: string): Promise<void> {
    await AdminApi.patch(`${MediaPageController.base}/folders/${folderId}`, { name });
  }

  static async deleteFolder(folderId: number): Promise<void> {
    await AdminApi.delete(`${MediaPageController.base}/folders/${folderId}`);
  }

  /** Re-parent a file or folder. The API expects the string `'null'` to mean "the root". */
  static async move(movingItem: MovingItem, targetFolderId: number | null): Promise<void> {
    const target = targetFolderId === null ? 'null' : targetFolderId;
    if (movingItem.type === 'file') {
      await AdminApi.patch(`${MediaPageController.base}/${movingItem.id}`, { folderId: target });
      return;
    }
    await AdminApi.patch(`${MediaPageController.base}/folders/${movingItem.id}`, { parentId: target });
  }

  /** Upload sequentially — the API assigns folder placement per file. */
  static async uploadFiles(files: File[], currentFolderId: number | null): Promise<void> {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      if (currentFolderId) formData.append('folderId', currentFolderId.toString());
      await AdminApi.upload(AdminConstants.ENDPOINTS.MEDIA.UPLOAD, formData);
    }
  }

  static async deleteItem(itemId: number): Promise<void> {
    await AdminApi.delete(`${MediaPageController.base}/${itemId}`);
  }

  static async updateDetails(itemId: number, alt: string, caption: string): Promise<void> {
    await AdminApi.patch(`${MediaPageController.base}/${itemId}`, { alt, caption });
  }

  /** Generate an optimized derivative; returns the fields to merge into the cached item. */
  static async optimize(itemId: number): Promise<Partial<MediaItem>> {
    const result = await AdminApi.post(`${MediaPageController.base}/${itemId}/optimize`, {});
    return {
      optimizedUrl: result.optimizedUrl,
      optimizedSize: result.optimizedSize,
      optimizedWidth: result.optimizedWidth,
      optimizedHeight: result.optimizedHeight,
    };
  }

  /** True only for an OS file drag — ignores internal element drags. */
  static isFileDrag(types?: readonly string[]): boolean {
    return Boolean(types?.includes('Files'));
  }
}
