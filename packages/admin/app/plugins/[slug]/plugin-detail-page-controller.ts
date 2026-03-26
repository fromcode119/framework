import { useEffect, useRef, useState } from 'react';
import { ContextHooks } from '@fromcode119/react';
import type { LoadedPlugin } from '@fromcode119/core/client';
import { ThemeHooks } from '@/components/use-theme';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { NotificationHooks } from '@/components/use-notification';
import type { PluginSettingsFormHandle } from '@/components/plugins/plugin-settings-form.interfaces';
import type {
  PluginDetailPageModel,
  PluginDetailTab,
  PluginLogEntry,
  PluginMarketplaceItem,
  PluginSandboxSettings,
} from './plugin-detail-page.interfaces';
import { PluginDetailPageService } from './plugin-detail-page-service';

export class PluginDetailPageController {
  static useModel(slug: string): PluginDetailPageModel {
    const router = useRouter();
    const pathname = usePathname();
    const { notify } = NotificationHooks.useNotify();
    const { triggerRefresh, refreshVersion } = ContextHooks.usePlugins();
    const searchParams = useSearchParams();
    const [plugin, setPlugin] = useState<LoadedPlugin | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [settingsDirty, setSettingsDirty] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const settingsFormRef = useRef<PluginSettingsFormHandle>(null);
    const [showDefinition, setShowDefinition] = useState(false);
    const [marketplaceItem, setMarketplaceItem] = useState<PluginMarketplaceItem | null>(null);
    const [activeTab, setActiveTab] = useState<PluginDetailTab>('overview');
    const [logs, setLogs] = useState<PluginLogEntry[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [sandboxSettings, setSandboxSettings] = useState<PluginSandboxSettings>(PluginDetailPageService.DEFAULT_SANDBOX_SETTINGS);
    const { theme } = ThemeHooks.useTheme();

    useEffect(() => {
      const loadPlugin = async () => {
        try {
          const found = await PluginDetailPageService.fetchPlugin(slug);
          if (!found) {
            router.push('/plugins');
            return;
          }
          setPlugin(found);
          setSandboxSettings(PluginDetailPageService.createSandboxSettings(found));
        } catch (error) {
          console.error('[PluginDetailPage] Failed to fetch plugin detail:', error);
        } finally {
          setLoading(false);
        }
      };

      loadPlugin();
    }, [slug, router, refreshVersion]);

    useEffect(() => {
      const checkUpdates = async () => {
        try {
          const item = await PluginDetailPageService.fetchMarketplaceItem(slug);
          if (item) setMarketplaceItem(item);
        } catch {}
      };

      checkUpdates();
    }, [slug, refreshVersion]);

    useEffect(() => {
      setActiveTab(PluginDetailPageService.parseTab(searchParams.get('tab')));
    }, [searchParams]);

    const fetchLogs = async () => {
      if (activeTab !== 'overview' || !slug) return;
      setLoadingLogs(true);
      try {
        setLogs(await PluginDetailPageService.fetchLogs(slug));
      } catch (error) {
        console.error('[PluginDetailPage] Failed to fetch logs:', error);
      } finally {
        setLoadingLogs(false);
      }
    };

    useEffect(() => {
      fetchLogs();
    }, [slug, activeTab, refreshVersion]);

    const handleUpdate = async () => {
      if (!plugin) return;
      setIsUpdating(true);
      try {
        await PluginDetailPageService.updatePlugin(plugin.manifest.slug);
        notify('success', 'Update Complete', `${plugin.manifest.name} has been updated to the latest version.`);
        triggerRefresh();
      } catch (error: any) {
        console.error('[PluginDetailPage] Update error:', error);
        notify('error', 'Update Failed', error.message || 'Update failed');
      } finally {
        setIsUpdating(false);
      }
    };

    const handleToggle = async () => {
      if (!plugin) return;
      try {
        const newState = plugin.state === 'active' ? false : true;
        await PluginDetailPageService.togglePlugin(plugin.manifest.slug, newState);
        const status = newState ? 'active' : 'inactive';
        setPlugin({
          ...plugin,
          state: status,
          approvedCapabilities: status === 'active' ? [...(plugin.manifest.capabilities || [])] : plugin.approvedCapabilities,
        });
        notify('success', 'Status Updated', `${plugin.manifest.name} is now ${status}.`);
        triggerRefresh();
      } catch (error: any) {
        console.error('[PluginDetailPage] Toggle error:', error);
        notify('error', 'Toggle Failed', error.message || 'Failed to update plugin state.');
      }
    };

    const handleSaveSandbox = async () => {
      if (!plugin) return;
      setIsSaving(true);
      try {
        const nextSandbox = await PluginDetailPageService.saveSandbox(plugin.manifest.slug, sandboxSettings);
        setPlugin({ ...plugin, sandbox: nextSandbox });
        notify(
          'success',
          'Resources Updated',
          sandboxSettings.enabled
            ? `Sandbox limits for ${plugin.manifest.name} updated.`
            : `Sandbox disabled for ${plugin.manifest.name}.`,
        );
        triggerRefresh();
      } catch (error: any) {
        console.error('[PluginDetailPage] Save sandbox error:', error);
        notify('error', 'Save Failed', error.message || 'Failed to update sandbox limits.');
      } finally {
        setIsSaving(false);
      }
    };

    const handleDelete = async () => {
      if (!plugin) return;
      setIsDeleting(true);
      try {
        await PluginDetailPageService.deletePlugin(plugin.manifest.slug);
        notify('success', 'Uninstalled', `${plugin.manifest.name} removed from system.`);
        triggerRefresh();
        router.push('/plugins');
      } catch (error: any) {
        console.error('[PluginDetailPage] Delete error:', error);
        notify('error', 'Uninstall Failed', error.message || 'An error occurred while deleting the plugin.');
        setIsDeleting(false);
        setShowDeleteConfirm(false);
      }
    };

    const handleTabChange = (tabId: PluginDetailTab) => {
      setActiveTab(tabId);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tabId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return {
      activeTab,
      fetchLogs,
      handleDelete,
      handleSaveSandbox,
      handleTabChange,
      handleToggle,
      handleUpdate,
      isDeleting,
      isSaving,
      isUpdating,
      loading,
      loadingLogs,
      logs,
      marketplaceItem,
      plugin,
      sandboxSettings,
      setSandboxSettings,
      setSettingsDirty,
      setSettingsSaving,
      settingsDirty,
      settingsFormRef,
      settingsSaving,
      setShowDefinition,
      setShowDeleteConfirm,
      showDefinition,
      showDeleteConfirm,
      theme,
    };
  }
}
