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

export class InstalledThemesPageController {
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
    const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
    const [showUploadPreview, setShowUploadPreview] = useState(false);
    const [uploadPreviewTitle, setUploadPreviewTitle] = useState('');
    const [uploadPreviewDescription, setUploadPreviewDescription] = useState('');
    const [uploadPreviewSections, setUploadPreviewSections] = useState<UploadPreviewSection[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const uploadThemeFile = async (file?: File | null) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.zip')) {
        notify('error', 'Upload Failed', 'Only .zip theme packages are supported.');
        return;
      }

      setIsUploading(true);
      const formData = new FormData();
      formData.append('theme', file);

      try {
        await AdminApi.upload(AdminConstants.ENDPOINTS.THEMES.UPLOAD, formData);
        notify('success', 'Upload Successful', 'Theme uploaded successfully.');
        await fetchThemes();
        triggerRefresh();
      } catch (error: any) {
        notify('error', 'Upload Failed', error.message);
      } finally {
        setIsUploading(false);
      }
    };

    const inspectThemeFile = async (file?: File | null) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.zip')) {
        notify('error', 'Upload Failed', 'Only .zip theme packages are supported.');
        return;
      }

      setIsInspectingUpload(true);
      const formData = new FormData();
      formData.append('theme', file);

      try {
        const response = await AdminApi.upload(AdminConstants.ENDPOINTS.THEMES.UPLOAD_INSPECT, formData);
        const info = (response as any)?.info || {};
        const dependencies = Array.isArray(info.dependencies) ? info.dependencies : [];
        const bundled = Array.isArray(info.bundledPlugins) ? info.bundledPlugins : [];
        const existing = info.existing || { installed: false };
        setUploadPreviewTitle(`Install theme "${info.name || info.slug || 'package'}"?`);
        setUploadPreviewDescription('Review theme contents before continuing.');
        setUploadPreviewSections([
          { title: 'Summary', items: [`Name: ${info.name || 'Unknown'}`, `Slug: ${info.slug || 'Unknown'}`, `Version: ${info.version || 'Unknown'}`, `Files: ${info.files ?? 'Unknown'}`] },
          {
            title: 'Bundled Plugins',
            items: bundled.length
              ? bundled.map((plugin: any) => {
                if (plugin?.pluginSlug) {
                  const version = plugin?.pluginVersion ? ` v${plugin.pluginVersion}` : '';
                  const name = plugin?.pluginName ? `${plugin.pluginName} (${plugin.pluginSlug})` : plugin.pluginSlug;
                  return `${name}${version} from ${plugin.archive}`;
                }
                return plugin?.archive || 'Unknown bundled plugin archive';
              })
              : ['No bundled plugin archives detected'],
          },
          { title: 'Required Marketplace Plugins', items: dependencies.length ? dependencies : ['No required marketplace plugins'] },
          {
            title: 'Install Impact',
            items: existing.installed
              ? [`This will replace installed theme "${info.slug}".`, `Current version: ${existing.version || 'Unknown'} (${existing.state || 'unknown'})`, `Incoming version: ${info.version || 'Unknown'}`]
              : ['This theme is not currently installed.'],
          },
        ]);
        setPendingUploadFile(file);
        setShowUploadPreview(true);
      } catch (error: any) {
        notify('error', 'Inspect Failed', error.message || 'Could not inspect theme package.');
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
        setPendingUploadFile(null);
      },
      confirmUploadPreview: async () => {
        if (!pendingUploadFile) return;
        await uploadThemeFile(pendingUploadFile);
        setShowUploadPreview(false);
        setPendingUploadFile(null);
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
