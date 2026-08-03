

import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';

import type { IInstalledThemeManifest } from '@/app/themes/installed/interfaces/installed-theme-manifest.interface';

export interface IInstalledThemesPageClientState extends Record<string, unknown> {
  themes: IInstalledThemeManifest[];
  marketplaceThemes: IInstalledThemeManifest[];
  loading: boolean;
  isUploading: boolean;
  isInspectingUpload: boolean;
  isDropActive: boolean;
  pendingUploadId: string | null;
  uploadProgressLabel: string | null;
  uploadProgressPercent: number | null;
  showUploadPreview: boolean;
  uploadPreviewTitle: string;
  uploadPreviewDescription: string;
  uploadPreviewSections: IUploadPreviewSection[];
}
