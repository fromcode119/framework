import type { RefObject } from 'react';
import type { LoadedPlugin } from '@fromcode119/core/client';
import type { DependencyIssue } from '@/components/ui/dependency-dialog.interfaces';
import type { UploadPreviewSection } from '@/components/ui/upload-preview-dialog.interfaces';
import type { PluginInstallOperation } from '@/lib/plugin-install-operation.interfaces';
import type { NotificationContextType } from '@/components/notification-context.interfaces';
import type { AdminPageHost } from '@/components/admin-page-host.interfaces';

export interface InstalledPluginMarketplaceItem {
  slug: string;
  version: string;
  dependencies?: Record<string, string>;
}

export interface PluginReapprovalEntry {
  slug: string;
  ok: boolean;
  error?: string;
}

export interface InstalledPluginsArchiveInspection {
  supported: boolean;
  uploadId?: string;
  previewTitle?: string;
  previewDescription?: string;
  previewSections?: UploadPreviewSection[];
}

/** What {@link InstalledPluginsPageActions} needs from the page-client to drive it, hook-free. */
export interface InstalledPluginsPageHost extends AdminPageHost<InstalledPluginsPageClientState> {
  readonly notify: NotificationContextType;
  triggerRefresh(): void;
  /** Reload installed plugins + marketplace registry into state. */
  refresh(): Promise<void>;
}

export interface InstalledPluginCardProps {
  hasImageError: boolean;
  hasUpdate: boolean;
  isDark: boolean;
  onDelete: (slug: string) => void;
  onImageError: (slug: string) => void;
  onToggle: (slug: string, currentEnabled: boolean, options?: { force?: boolean; recursive?: boolean }) => Promise<void>;
  plugin: LoadedPlugin;
}

export interface InstalledPluginsViewProps {
  closeDeleteConfirm: () => void;
  closeDependencyConfirm: () => void;
  closeUploadPreview: () => void;
  confirmUploadPreview: () => Promise<void>;
  deleteConfirmDescription: string;
  dependencyIssues: DependencyIssue[];
  failedPluginsCount: number;
  heldPluginsCount: number;
  onReapproveAll: () => Promise<void>;
  filteredPlugins: LoadedPlugin[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (event: React.DragEvent<HTMLDivElement>) => Promise<void>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  hasPluginUpdate: (plugin: LoadedPlugin) => boolean;
  handleToggle: (slug: string, currentEnabled: boolean, options?: { force?: boolean; recursive?: boolean }) => Promise<void>;
  handleUploadClick: () => void;
  imageErrors: Record<string, boolean>;
  isActivating: boolean;
  isDeleting: boolean;
  isDropActive: boolean;
  isInspectingUpload: boolean;
  isUploading: boolean;
  loading: boolean;
  operationStatus: PluginInstallOperation | null;
  markImageError: (slug: string) => void;
  onDeleteConfirm: () => Promise<void>;
  onDeletePrompt: (slug: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  showDeleteConfirm: boolean;
  showDependencyConfirm: boolean;
  showUploadPreview: boolean;
  targetPlugin: string | null;
  theme: string;
  toggleDependencies: (recursive: boolean, force: boolean) => Promise<void>;
  uploadProgressLabel: string | null;
  uploadProgressPercent: number | null;
  uploadPreviewDescription: string;
  uploadPreviewSections: UploadPreviewSection[];
  uploadPreviewTitle: string;
}

export interface InstalledPluginsPageClientState {
  plugins: LoadedPlugin[];
  marketplaceData: InstalledPluginMarketplaceItem[];
  loading: boolean;
  searchQuery: string;
  showDeleteConfirm: boolean;
  showDependencyConfirm: boolean;
  dependencyIssues: DependencyIssue[];
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
  uploadPreviewSections: UploadPreviewSection[];
  operationStatus: PluginInstallOperation | null;
  imageErrors: Record<string, boolean>;
}

export interface InstalledPluginsPageModel {
  closeDeleteConfirm: () => void;
  closeDependencyConfirm: () => void;
  closeUploadPreview: () => void;
  confirmUploadPreview: () => Promise<void>;
  deleteConfirmDescription: string;
  dependencyIssues: DependencyIssue[];
  failedPluginsCount: number;
  heldPluginsCount: number;
  onReapproveAll: () => Promise<void>;
  filteredPlugins: LoadedPlugin[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (event: React.DragEvent<HTMLDivElement>) => Promise<void>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  hasPluginUpdate: (plugin: LoadedPlugin) => boolean;
  handleToggle: (slug: string, currentEnabled: boolean, options?: { force?: boolean; recursive?: boolean }) => Promise<void>;
  handleUploadClick: () => void;
  imageErrors: Record<string, boolean>;
  isActivating: boolean;
  isDeleting: boolean;
  isDropActive: boolean;
  isInspectingUpload: boolean;
  isUploading: boolean;
  loading: boolean;
  operationStatus: PluginInstallOperation | null;
  markImageError: (slug: string) => void;
  onDeleteConfirm: () => Promise<void>;
  onDeletePrompt: (slug: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  showDeleteConfirm: boolean;
  showDependencyConfirm: boolean;
  showUploadPreview: boolean;
  targetPlugin: string | null;
  theme: string;
  toggleDependencies: (recursive: boolean, force: boolean) => Promise<void>;
  uploadProgressLabel: string | null;
  uploadProgressPercent: number | null;
  uploadPreviewDescription: string;
  uploadPreviewSections: UploadPreviewSection[];
  uploadPreviewTitle: string;
}
