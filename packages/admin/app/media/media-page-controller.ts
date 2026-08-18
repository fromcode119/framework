import { MovingItemType } from '@/app/media/enums/moving-item-type.enum';
import { AdminApi } from '@/lib/api';
import { MediaPickerSourceService } from '@/components/media/media-picker-source-service';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import type { IMediaLibraryPage } from '@/app/media/interfaces/media-library-page.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';
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
  /**
   * Files that ship inside the ACTIVE THEME, in the shape the library renders.
   *
   * The same source the media picker already uses — the library simply never asked for it, so a file
   * the picker could see did not exist on this screen. Marked `readOnly`: they live in the theme
   * bundle, so they cannot be deleted, moved, optimized, made private or shared.
   *
   * Only listed at the library ROOT and when not searching a folder — they belong to no folder, so
   * showing them inside one would imply a location they do not have.
   */
  static async fetchThemeAssets(): Promise<IMediaItem[]> {
    const assets = await MediaPickerSourceService.fetchThemeAssets().catch(() => []);
    return assets.map((asset: any) => ({
      id: asset.id,
      filename: asset.filename,
      originalName: asset.filename,
      mimeType: asset.mimeType,
      fileSize: 0,
      url: asset.url,
      relativePath: asset.relativePath,
      folderId: null,
      createdAt: '',
      readOnly: true,
    })) as IMediaItem[];
  }

  /** Server page size. Must match the API's own default, or "is there more" mis-reads. */
  static readonly PAGE_SIZE = 60;

  static async fetchLibrary(currentFolderId: number | null, searchQuery: string, offset = 0): Promise<IMediaLibraryPage> {
    const q = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : '';
    const f = currentFolderId !== null ? `&folderId=${currentFolderId}` : (searchQuery ? '' : '&folderId=null');
    const page = `&limit=${MediaPageController.PAGE_SIZE}&offset=${offset}`;

    const [items, folders] = await Promise.all([
      AdminApi.get(`${MediaPageController.base}?${q}${f}${page}`),
      // Folders are not paged and do not change between pages — only fetch them for the first one.
      offset === 0
        ? AdminApi.get(`${MediaPageController.base}/folders?parentId=${currentFolderId || 'null'}`)
        : Promise.resolve([]),
    ]);

    const rows: IMediaItem[] = Array.isArray(items) ? items : [];
    return {
      items: rows,
      folders,
      // A full page means there is probably another; a short one is definitively the end. No total
      // needed, and no second count query.
      hasMore: rows.length === MediaPageController.PAGE_SIZE,
    };
  }

  /** Breadcrumb trail for a folder. The root has no trail. */
  static async fetchFolderPath(currentFolderId: number | null): Promise<IMediaFolder[]> {
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
  static async move(movingItem: IMovingItem, targetFolderId: number | null): Promise<void> {
    const target = targetFolderId === null ? 'null' : targetFolderId;
    if (movingItem.type === MovingItemType.FILE) {
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

  static async updateDetails(itemId: number, alt: string, caption: string, visibility: string): Promise<void> {
    // visibility travels with the other details: the server moves the bytes between storage spaces,
    // so this is one atomic-looking change to the operator rather than a separate 'move file' action.
    await AdminApi.patch(`${MediaPageController.base}/${itemId}`, { alt, caption, visibility });
  }

  /** Generate an optimized derivative; returns the fields to merge into the cached item. */
  static async optimize(itemId: number): Promise<Partial<IMediaItem>> {
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
