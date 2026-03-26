import type { RefObject } from 'react';
import type { LoadedPlugin } from '@fromcode119/core/client';
import type { DependencyIssue } from '@/components/ui/dependency-dialog.interfaces';
import type { UploadPreviewSection } from '@/components/ui/upload-preview-dialog.interfaces';

export interface InstalledPluginMarketplaceItem {
  slug: string;
  version: string;
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
  uploadPreviewDescription: string;
  uploadPreviewSections: UploadPreviewSection[];
  uploadPreviewTitle: string;
}

export interface InstalledPluginsPageModel {
  closeDeleteConfirm: () => void;
  closeDependencyConfirm: () => void;
  closeUploadPreview: () => void;
  confirmUploadPreview: () => Promise<void>;
  deleteConfirmDescription: string;
  dependencyIssues: DependencyIssue[];
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
  uploadPreviewDescription: string;
  uploadPreviewSections: UploadPreviewSection[];
  uploadPreviewTitle: string;
}
