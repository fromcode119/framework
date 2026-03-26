import { useEffect, useRef, useState } from 'react';
import { ContextHooks } from '@fromcode119/react';
import type { LoadedPlugin } from '@fromcode119/core/client';
import { ThemeHooks } from '@/components/use-theme';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { NotificationHooks } from '@/components/use-notification';
import type { DependencyIssue } from '@/components/ui/dependency-dialog.interfaces';
import type { UploadPreviewSection } from '@/components/ui/upload-preview-dialog.interfaces';
import type {
  InstalledPluginMarketplaceItem,
  InstalledPluginsPageModel,
} from './installed-plugins-page.interfaces';

export class InstalledPluginsPageController {
  static useModel(): InstalledPluginsPageModel {
    const { theme } = ThemeHooks.useTheme();
    const { notify } = NotificationHooks.useNotify();
    const { triggerRefresh, refreshVersion } = ContextHooks.usePlugins();
    const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
    const [marketplaceData, setMarketplaceData] = useState<InstalledPluginMarketplaceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDependencyConfirm, setShowDependencyConfirm] = useState(false);
    const [dependencyIssues, setDependencyIssues] = useState<DependencyIssue[]>([]);
    const [targetPlugin, setTargetPlugin] = useState<string | null>(null);
    const [pluginToDelete, setPluginToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isInspectingUpload, setIsInspectingUpload] = useState(false);
    const [isDropActive, setIsDropActive] = useState(false);
    const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
    const [showUploadPreview, setShowUploadPreview] = useState(false);
    const [uploadPreviewTitle, setUploadPreviewTitle] = useState('');
    const [uploadPreviewDescription, setUploadPreviewDescription] = useState('');
    const [uploadPreviewSections, setUploadPreviewSections] = useState<UploadPreviewSection[]>([]);
    const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchPlugins = async () => {
      setLoading(true);
      try {
        const pluginsResult = await AdminApi.get(`${AdminConstants.ENDPOINTS.PLUGINS.LIST}?refresh=1`);
        setPlugins(Array.isArray(pluginsResult) ? pluginsResult : []);
      } catch (error) {
        console.error('[InstalledPluginsPage] Failed to fetch installed plugins:', error);
        setPlugins([]);
      } finally {
        setLoading(false);
      }

      try {
        const marketplaceTimeoutMs = 3000;
        const marketplaceResult = await Promise.race([
          AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.MARKETPLACE),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Marketplace timeout after ${marketplaceTimeoutMs}ms`)), marketplaceTimeoutMs)),
        ]);
        const registry = marketplaceResult as { plugins?: InstalledPluginMarketplaceItem[] };
        setMarketplaceData(Array.isArray(registry?.plugins) ? registry.plugins : []);
      } catch (error) {
        console.warn('[InstalledPluginsPage] Marketplace unavailable, continuing with installed plugins only:', error);
        setMarketplaceData([]);
      }
    };

    const uploadPluginFile = async (file?: File | null) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.zip')) {
        notify('error', 'Upload Failed', 'Only .zip plugin packages are supported.');
        return;
      }

      setIsUploading(true);
      const formData = new FormData();
      formData.append('plugin', file);

      try {
        await AdminApi.upload(AdminConstants.ENDPOINTS.PLUGINS.UPLOAD, formData);
        notify('success', 'Upload Successful', 'Plugin uploaded successfully.');
        await fetchPlugins();
      } catch (error: any) {
        notify('error', 'Upload Failed', error.message);
      } finally {
        setIsUploading(false);
      }
    };

    const inspectPluginFile = async (file?: File | null) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.zip')) {
        notify('error', 'Upload Failed', 'Only .zip plugin packages are supported.');
        return;
      }

      setIsInspectingUpload(true);
      const formData = new FormData();
      formData.append('plugin', file);

      try {
        const response = await AdminApi.upload(AdminConstants.ENDPOINTS.PLUGINS.UPLOAD_INSPECT, formData);
        const info = (response as any)?.info || {};
        const dependencies = Array.isArray(info.dependencies) ? info.dependencies : [];
        const peerDependencies = Array.isArray(info.peerDependencies) ? info.peerDependencies : [];
        const existing = info.existing || { installed: false };

        setUploadPreviewTitle(`Install plugin "${info.name || info.slug || 'package'}"?`);
        setUploadPreviewDescription('Review package contents before continuing.');
        setUploadPreviewSections([
          { title: 'Summary', items: [`Name: ${info.name || 'Unknown'}`, `Slug: ${info.slug || 'Unknown'}`, `Version: ${info.version || 'Unknown'}`, `Files: ${info.files ?? 'Unknown'}`, `UI bundle: ${info.hasUiBundle ? 'Yes' : 'No'}`] },
          { title: 'Dependencies', items: dependencies.length ? dependencies : ['No required plugin dependencies'] },
          { title: 'Peer Dependencies', items: peerDependencies.length ? peerDependencies : ['No peer dependencies'] },
          {
            title: 'Install Impact',
            items: existing.installed
              ? [`This will replace installed plugin "${info.slug}".`, `Current version: ${existing.version || 'Unknown'} (${existing.state || 'unknown'})`, `Incoming version: ${info.version || 'Unknown'}`]
              : ['This plugin is not currently installed.'],
          },
        ]);
        setPendingUploadFile(file);
        setShowUploadPreview(true);
      } catch (error: any) {
        notify('error', 'Inspect Failed', error.message || 'Could not inspect plugin package.');
      } finally {
        setIsInspectingUpload(false);
      }
    };

    useEffect(() => {
      fetchPlugins();
    }, [refreshVersion]);

    const handleToggle = async (slug: string, currentEnabled: boolean, options: { force?: boolean; recursive?: boolean } = {}) => {
      try {
        if (!currentEnabled) setIsActivating(true);
        await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.TOGGLE(slug), { enabled: !currentEnabled, ...options });
        notify('success', 'Plugin Updated', `${slug} is now ${!currentEnabled ? 'active' : 'inactive'}.`);
        setPlugins((value) => value.map((plugin) => plugin.manifest.slug === slug ? { ...plugin, state: !currentEnabled ? 'active' : 'inactive' } : plugin));
        if (options.recursive || options.force) {
          setShowDependencyConfirm(false);
          await fetchPlugins();
        }
        triggerRefresh();
      } catch (error: any) {
        if (error.status === 409 && error.data?.issues) {
          setDependencyIssues(error.data.issues);
          setTargetPlugin(slug);
          setShowDependencyConfirm(true);
        } else {
          notify('error', 'Update Failed', error.message);
        }
      } finally {
        setIsActivating(false);
      }
    };

    const onDeleteConfirm = async () => {
      if (!pluginToDelete) return;
      setIsDeleting(true);
      try {
        const plugin = plugins.find((value) => value.manifest.slug === pluginToDelete);
        if (plugin && plugin.state === 'active') {
          await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.TOGGLE(pluginToDelete), { enabled: false });
        }
        await AdminApi.delete(AdminConstants.ENDPOINTS.PLUGINS.DELETE(pluginToDelete));
        notify('success', 'Deleted', `Plugin ${pluginToDelete} removed.`);
        setPlugins((value) => value.filter((plugin) => plugin.manifest.slug !== pluginToDelete));
        setShowDeleteConfirm(false);
        triggerRefresh();
      } catch (error: any) {
        notify('error', 'Delete Failed', error.message);
      } finally {
        setIsDeleting(false);
        setPluginToDelete(null);
      }
    };

    const filteredPlugins = plugins.filter((plugin) =>
      (plugin.manifest.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (plugin.manifest.slug?.toLowerCase() || '').includes(searchQuery.toLowerCase()),
    );
    const deleteConfirmDescription = `This will permanently remove ${pluginToDelete} and all its data.${plugins.find((plugin) => plugin.manifest.slug === pluginToDelete)?.state === 'active' ? " Since it's currently active, we'll deactivate it first." : ''}`;

    return {
      closeDeleteConfirm: () => {
        setShowDeleteConfirm(false);
        setPluginToDelete(null);
      },
      closeDependencyConfirm: () => {
        setShowDependencyConfirm(false);
        setTargetPlugin(null);
      },
      closeUploadPreview: () => {
        if (isUploading) return;
        setShowUploadPreview(false);
        setPendingUploadFile(null);
      },
      confirmUploadPreview: async () => {
        if (!pendingUploadFile) return;
        await uploadPluginFile(pendingUploadFile);
        setShowUploadPreview(false);
        setPendingUploadFile(null);
      },
      deleteConfirmDescription,
      dependencyIssues,
      fileInputRef,
      filteredPlugins,
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
        await inspectPluginFile(event.dataTransfer.files?.[0]);
      },
      handleFileChange: async (event) => {
        const file = event.target.files?.[0];
        await inspectPluginFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      hasPluginUpdate: (plugin) => marketplaceData.some((entry) => entry.slug === plugin.manifest.slug && entry.version !== plugin.manifest.version),
      handleToggle,
      handleUploadClick: () => {
        if (isUploading || isInspectingUpload) return;
        fileInputRef.current?.click();
      },
      imageErrors,
      isActivating,
      isDeleting,
      isDropActive,
      isInspectingUpload,
      isUploading,
      loading,
      markImageError: (slug) => {
        setImageErrors((value) => ({ ...value, [slug]: true }));
      },
      onDeleteConfirm,
      onDeletePrompt: (slug) => {
        setPluginToDelete(slug);
        setShowDeleteConfirm(true);
      },
      searchQuery,
      setSearchQuery,
      showDeleteConfirm,
      showDependencyConfirm,
      showUploadPreview,
      targetPlugin,
      theme,
      toggleDependencies: async (recursive, force) => {
        if (!targetPlugin) return;
        if (recursive) {
          const missing = dependencyIssues.filter((issue) => issue.type === 'missing');
          for (const issue of missing) {
            notify('info', 'Dependency Install', `Downloading ${issue.slug} from marketplace...`);
            try {
              await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.INSTALL(issue.slug), {});
            } catch (error: any) {
              notify('error', 'Auto-Install Failed', `Could not install ${issue.slug}: ${error.message}`);
              return;
            }
          }
        }
        await handleToggle(targetPlugin, false, { recursive, force });
      },
      uploadPreviewDescription,
      uploadPreviewSections,
      uploadPreviewTitle,
    };
  }
}
