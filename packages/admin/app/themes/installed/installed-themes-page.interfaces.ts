import type { RefObject } from 'react';
import type { ThemeManifest } from '@fromcode119/core/client';
import type { UploadPreviewSection } from '@/components/ui/upload-preview-dialog.interfaces';

export interface InstalledThemeManifest extends ThemeManifest {
  downloadUrl?: string;
  iconUrl?: string;
  state?: 'active' | 'inactive';
}

export interface InstalledThemeCardProps {
  isDark: boolean;
  onActivate: (slug: string) => Promise<void>;
  onDelete: (slug: string, isActive: boolean) => Promise<void>;
  onUpdate: (slug: string) => Promise<void>;
  theme: InstalledThemeManifest;
  updateVersion: string | null;
}

export interface InstalledThemesViewProps {
  closeUploadPreview: () => void;
  confirmUploadPreview: () => Promise<void>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (event: React.DragEvent<HTMLDivElement>) => Promise<void>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleUploadClick: () => void;
  isDropActive: boolean;
  isInspectingUpload: boolean;
  isUploading: boolean;
  loading: boolean;
  onActivate: (slug: string) => Promise<void>;
  onDelete: (slug: string, isActive: boolean) => Promise<void>;
  onUpdate: (slug: string) => Promise<void>;
  showUploadPreview: boolean;
  themes: InstalledThemeManifest[];
  themeMode: string;
  uploadPreviewDescription: string;
  uploadPreviewSections: UploadPreviewSection[];
  uploadPreviewTitle: string;
  updateVersionForTheme: (theme: InstalledThemeManifest) => string | null;
}

export interface InstalledThemesPageModel {
  closeUploadPreview: () => void;
  confirmUploadPreview: () => Promise<void>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (event: React.DragEvent<HTMLDivElement>) => Promise<void>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleUploadClick: () => void;
  isDropActive: boolean;
  isInspectingUpload: boolean;
  isUploading: boolean;
  loading: boolean;
  onActivate: (slug: string) => Promise<void>;
  onDelete: (slug: string, isActive: boolean) => Promise<void>;
  onUpdate: (slug: string) => Promise<void>;
  showUploadPreview: boolean;
  themes: InstalledThemeManifest[];
  themeMode: string;
  uploadPreviewDescription: string;
  uploadPreviewSections: UploadPreviewSection[];
  uploadPreviewTitle: string;
  updateVersionForTheme: (theme: InstalledThemeManifest) => string | null;
}
