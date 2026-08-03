

import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';

export interface IInstalledThemesArchiveInspection {
  supported: boolean;
  uploadId?: string;
  previewTitle?: string;
  previewDescription?: string;
  previewSections?: IUploadPreviewSection[];
}
