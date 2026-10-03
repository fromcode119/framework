import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';

export interface IInstalledPluginsArchiveInspection {
  supported: boolean;
  uploadId?: string;
  /** The package's plugin, so its consent dialog can open once it is installed. */
  slug?: string;
  previewTitle?: string;
  previewDescription?: string;
  previewSections?: IUploadPreviewSection[];
}
