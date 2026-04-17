import { useEffect, useRef, useState } from 'react';
import { ContextHooks } from '@fromcode119/react';
import { ThemeHooks } from '@/components/use-theme';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { NotificationHooks } from '@/components/use-notification';
import type { UploadPreviewSection } from '@/components/ui/upload-preview-dialog.interfaces';
import type {
  InstalledThemeManifest,
  InstalledThemesPageModel,
} from './installed-themes-page.interfaces';
import { InstalledThemesUploadService } from './installed-themes-upload-service';

export class InstalledThemesPageController {
  private static readonly ARCHIVE_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;

  static useModel(): InstalledThemesPageModel {
    const { theme } = ThemeHooks.useTheme();
    const { notify } = NotificationHooks.useNotify();
    const { triggerRefresh } = ContextHooks.usePlugins();
    const [themes, setThemes] = useState<InstalledThemeManifest[]>([]);
    const [marketplaceThemes, setMarketplaceThemes] = useState<InstalledThemeManifest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isInspectingUpload, setIsInspectingUpload] = useState(false);
    const [isDropActive, setIsDropActive] = useState(false);
    const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
    const [uploadProgressLabel, setUploadProgressLabel] = useState<string | null>(null);
    const [uploadProgressPercent, setUploadProgressPercent] = useState<number | null>(null);
    const [showUploadPreview, setShowUploadPreview] = useState(false);
    const [uploadPreviewTitle, setUploadPreviewTitle] = useState('');
    const [uploadPreviewDescription, setUploadPreviewDescription] = useState('');
    const [uploadPreviewSections, setUploadPreviewSections] = useState<UploadPreviewSection[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const clearUploadProgress = () => {
      setUploadProgressLabel(null);
      setUploadProgressPercent(null);
    };

    const fetchThemes = async () => {
      setLoading(true);
      try {
        const [installedData, marketplaceData] = await Promise.all([
          AdminApi.get(AdminConstants.ENDPOINTS.THEMES.LIST),
          AdminApi.get(AdminConstants.ENDPOINTS.THEMES.MARKETPLACE),
        ]);
        const installed = Array.isArray(installedData) ? installedData : installedData.themes || [];
        const marketplace = Array.isArray(marketplaceData) ? marketplaceData : marketplaceData.themes || [];
        setThemes(installed);
        setMarketplaceThemes(marketplace);
      } catch (error) {
        console.error('[InstalledThemesPage] Failed to fetch themes:', error);
        notify('error', 'Fetch Failed', 'Could not load themes.');
      } finally {
        setLoading(false);
      }
    };

    const uploadThemeFile = async (uploadId?: string | null) => {
      if (!uploadId) return;

      setIsUploading(true);
      try {
        await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.UPLOAD_COMPLETE, { uploadId });
        notify('success', 'Upload Successful', 'Theme uploaded successfully.');
        await fetchThemes();
        triggerRefresh();
      } catch (error: any) {
        notify('error', 'Upload Failed', error.message);
      } finally {
        setIsUploading(false);
        clearUploadProgress();
      }
    };

    const inspectThemeFile = async (file?: File | null) => {
      if (!file) return;
      if (!InstalledThemesUploadService.isSupportedArchive(file)) {
        notify('error', 'Upload Failed', 'Only .zip or .tar.gz theme packages are supported.');
        return;
      }

      setIsInspectingUpload(true);

      try {
        const uploadId = await InstalledThemesUploadService.stageArchive(file, {
          chunkSizeBytes: InstalledThemesPageController.ARCHIVE_CHUNK_SIZE_BYTES,
          onProgress: (label, percent) => {
            setUploadProgressLabel(label);
            setUploadProgressPercent(percent);
          },
        });
        const response = await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.UPLOAD_SESSION_INSPECT, { uploadId });
        const info = (response as any)?.info || {};
        setUploadPreviewTitle(`Install theme "${info.name || info.slug || 'package'}"?`);
        setUploadPreviewDescription('Review theme contents before continuing.');
        setUploadPreviewSections(InstalledThemesUploadService.buildPreviewSections(info));
        setPendingUploadId(uploadId);
        setShowUploadPreview(true);
      } catch (error: any) {
        setPendingUploadId(null);
        notify('error', 'Inspect Failed', error.message || 'Could not inspect theme package.');
        clearUploadProgress();
      } finally {
        setIsInspectingUpload(false);
      }
    };

    useEffect(() => {
      fetchThemes();
    }, []);

    return {
      closeUploadPreview: () => {
        if (isUploading) return;
        setShowUploadPreview(false);
        setPendingUploadId(null);
        clearUploadProgress();
      },
      confirmUploadPreview: async () => {
        if (!pendingUploadId) return;
        await uploadThemeFile(pendingUploadId);
        setShowUploadPreview(false);
        setPendingUploadId(null);
      },
      fileInputRef,
      handleDragLeave: (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDropActive(false);
      },
      handleDragOver: (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDropActive(true);
      },
      handleDrop: async (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDropActive(false);
        await inspectThemeFile(event.dataTransfer.files?.[0]);
      },
      handleFileChange: async (event) => {
        const file = event.target.files?.[0];
        await inspectThemeFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      handleUploadClick: () => {
        if (isUploading || isInspectingUpload) return;
        fileInputRef.current?.click();
      },
      isDropActive,
      isInspectingUpload,
      isUploading,
      loading,
      onActivate: async (slug) => {
        try {
          await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.ACTIVATE(slug));
          notify('success', 'Theme Activated', `${slug} is now the active theme.`);
          setThemes((value) => value.map((item) => ({ ...item, state: item.slug === slug ? 'active' : 'inactive' })));
          triggerRefresh();
        } catch (error: any) {
          notify('error', 'Activation Failed', error.message);
        }
      },
      onDisable: async (slug) => {
        if (!confirm(`Disable theme "${slug}"? The frontend will fall back to the starter view until another theme is activated.`)) {
          return;
        }

        try {
          await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.DISABLE(slug));
          notify('success', 'Theme Disabled', `${slug} is no longer active.`);
          setThemes((value) => value.map((item) => ({ ...item, state: 'inactive' })));
          triggerRefresh();
        } catch (error: any) {
          notify('error', 'Disable Failed', error.message);
        }
      },
      onDelete: async (slug, isActive) => {
        const confirmationMessage = isActive
          ? `Theme "${slug}" is active. The system will switch to another theme if available, or continue with no active theme. Continue?`
          : `Are you sure you want to delete theme "${slug}"? This cannot be undone.`;
        if (!confirm(confirmationMessage)) return;
        try {
          await AdminApi.delete(AdminConstants.ENDPOINTS.THEMES.DELETE(slug));
          notify('success', 'Theme Deleted', `${slug} has been removed.`);
          await fetchThemes();
        } catch (error: any) {
          notify('error', 'Deletion Failed', error.message);
        }
      },
      onUpdate: async (slug) => {
        try {
          notify('info', 'Updating...', `Downloading latest version of ${slug}...`);
          await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.INSTALL(slug));
          notify('success', 'Updated', `Theme ${slug} has been updated.`);
          await fetchThemes();
          triggerRefresh();
        } catch (error: any) {
          notify('error', 'Update Failed', error.message);
        }
      },
      showUploadPreview,
      themes,
      themeMode: theme,
      uploadProgressLabel,
      uploadProgressPercent,
      uploadPreviewDescription,
      uploadPreviewSections,
      uploadPreviewTitle,
      updateVersionForTheme: (installedTheme) => {
        const marketplaceTheme = marketplaceThemes.find((item) => item.slug === installedTheme.slug);
        if (!marketplaceTheme || marketplaceTheme.version === installedTheme.version) return null;
        return marketplaceTheme.version;
      },
    };
  }
}
