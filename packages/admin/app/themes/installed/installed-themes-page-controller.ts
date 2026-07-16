import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { InstalledThemesUploadService } from './installed-themes-upload-service';
import type {
  InstalledThemeManifest,
  InstalledThemesArchiveInspection,
  InstalledThemesFetchResult,
} from './installed-themes-page.interfaces';

/**
 * Data access + business logic for the installed-themes page. Hook-free by contract: the page-client
 * class owns React state, lifecycle and notifications; this controller owns "how to fetch/do it".
 */
export class InstalledThemesPageController {
  private static readonly ARCHIVE_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;

  /** Load installed + marketplace themes, normalizing both list shapes the API may return. */
  static async fetchThemes(): Promise<InstalledThemesFetchResult> {
    const [installedData, marketplaceData] = await Promise.all([
      AdminApi.get(AdminConstants.ENDPOINTS.THEMES.LIST),
      AdminApi.get(AdminConstants.ENDPOINTS.THEMES.MARKETPLACE),
    ]);

    return {
      themes: InstalledThemesPageController.normalizeThemeList(installedData),
      marketplaceThemes: InstalledThemesPageController.normalizeThemeList(marketplaceData),
    };
  }

  private static normalizeThemeList(data: any): InstalledThemeManifest[] {
    return Array.isArray(data) ? data : data?.themes || [];
  }

  /**
   * Stage an archive and inspect it. Returns `supported: false` for a non-archive file so the caller
   * can surface its own message without this class owning notification copy.
   */
  static async inspectArchive(
    file: File,
    onProgress: (label: string, percent: number) => void,
  ): Promise<InstalledThemesArchiveInspection> {
    if (!InstalledThemesUploadService.isSupportedArchive(file)) return { supported: false };

    const uploadId = await InstalledThemesUploadService.stageArchive(file, {
      chunkSizeBytes: InstalledThemesPageController.ARCHIVE_CHUNK_SIZE_BYTES,
      onProgress,
    });
    const response = await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.UPLOAD_SESSION_INSPECT, { uploadId });
    const info = (response as any)?.info || {};

    return {
      supported: true,
      uploadId,
      previewTitle: `Install theme "${info.name || info.slug || 'package'}"?`,
      previewDescription: 'Review theme contents before continuing.',
      previewSections: InstalledThemesUploadService.buildPreviewSections(info),
    };
  }

  /** Finalize a staged upload, installing the theme. */
  static async completeUpload(uploadId: string): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.UPLOAD_COMPLETE, { uploadId });
  }

  static async activate(slug: string): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.ACTIVATE(slug));
  }

  static async disable(slug: string): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.DISABLE(slug));
  }

  static async delete(slug: string): Promise<void> {
    await AdminApi.delete(AdminConstants.ENDPOINTS.THEMES.DELETE(slug));
  }

  /** Install the latest marketplace build over the installed copy. */
  static async update(slug: string): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.INSTALL(slug));
  }

  /** The marketplace version when it differs from the installed one, else null. */
  static resolveUpdateVersion(
    installedTheme: InstalledThemeManifest,
    marketplaceThemes: InstalledThemeManifest[],
  ): string | null {
    const marketplaceTheme = marketplaceThemes.find((item) => item.slug === installedTheme.slug);
    if (!marketplaceTheme || marketplaceTheme.version === installedTheme.version) return null;
    return marketplaceTheme.version;
  }

  static disableConfirmationMessage(slug: string): string {
    return `Disable theme "${slug}"? The frontend will fall back to the starter view until another theme is activated.`;
  }

  static deleteConfirmationMessage(slug: string, isActive: boolean): string {
    return isActive
      ? `Theme "${slug}" is active. The system will switch to another theme if available, or continue with no active theme. Continue?`
      : `Are you sure you want to delete theme "${slug}"? This cannot be undone.`;
  }
}
