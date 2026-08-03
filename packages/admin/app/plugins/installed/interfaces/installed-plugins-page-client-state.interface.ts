import type { ILoadedPlugin } from '@fromcode119/core/client';
import { IDependencyIssue } from '@/components/ui/interfaces/dependency-issue.interface';
import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';
import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';

import type { IInstalledPluginMarketplaceItem } from '@/app/plugins/installed/interfaces/installed-plugin-marketplace-item.interface';

export interface IInstalledPluginsPageClientState extends Record<string, unknown> {
  plugins: ILoadedPlugin[];
  marketplaceData: IInstalledPluginMarketplaceItem[];
  loading: boolean;
  searchQuery: string;
  showDeleteConfirm: boolean;
  showDependencyConfirm: boolean;
  dependencyIssues: IDependencyIssue[];
  targetPlugin: string | null;
  pluginToDelete: string | null;
  isDeleting: boolean;
  isActivating: boolean;
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
  operationStatus: IPluginInstallOperation | null;
  imageErrors: Record<string, boolean>;
}
