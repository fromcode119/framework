import { AuthHooks } from '@/components/view/use-auth.client';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { PluginSettingsForm } from '@/components/plugins/view/plugin-settings-form.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { useEffect, useRef, useState } from 'react';

import { ContextHooks } from '@fromcode119/react';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { PluginState } from '@fromcode119/core/client';
import { ThemeHooks } from '@/components/view/use-theme.client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { NotificationHooks } from '@/components/view/use-notification.client';

import { PluginInstallOperationService } from '@/lib/plugin-install-operation-service';
import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';
import type { IPluginDetailPageModel } from '@/app/plugins/[slug]/interfaces/plugin-detail-page-model.interface';
import type { IPluginLogEntry } from '@/app/plugins/[slug]/interfaces/plugin-log-entry.interface';
import type { IPluginMarketplaceItem } from '@/app/plugins/[slug]/interfaces/plugin-marketplace-item.interface';
import type { IPluginSandboxSettings } from '@/app/plugins/[slug]/interfaces/plugin-sandbox-settings.interface';
import { PluginDetailPageService } from '@/app/plugins/[slug]/plugin-detail-page-service';
import { PluginAssetLoaderService } from '@/app/services/plugin-asset-loader-service';

export class PluginDetailPageController {
  static useModel(slug: string): IPluginDetailPageModel {
    const router = useRouter();
    const pathname = usePathname();
    const { notify } = NotificationHooks.useNotify();
    const { triggerRefresh, refreshVersion } = ContextHooks.usePlugins();
    // The marketplace listing and a plugin's process logs describe the PLATFORM — what may be installed
    // on the shared container, and what its processes printed. The API answers `platform_admin_required`
    // to a site administrator, so asking anyway just logged a failure on every visit to this page.
    const canManagePlatform = PlatformAccess.canManagePlatform(AuthHooks.useAuth().user);
    const searchParams = useSearchParams();
    const [plugin, setPlugin] = useState<ILoadedPlugin | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [installOperation, setInstallOperation] = useState<IPluginInstallOperation | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [settingsDirty, setSettingsDirty] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const settingsFormRef = useRef<PluginSettingsForm>(null);
    const [showDefinition, setShowDefinition] = useState(false);
    const [marketplaceItem, setMarketplaceItem] = useState<IPluginMarketplaceItem | null>(null);
    const [activeTab, setActiveTab] = useState<PluginDetailTab>(PluginDetailTab.OVERVIEW);
    const [logs, setLogs] = useState<IPluginLogEntry[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [sandboxSettings, setSandboxSettings] = useState<IPluginSandboxSettings>(PluginDetailPageService.DEFAULT_SANDBOX_SETTINGS);
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

    // This plugin's own admin UI, loaded because this is the page that administers it.
    //
    // The metadata-driven loader cannot do it: it is filtered by tenant visibility, and a plugin is
    // administered in PLATFORM scope where that filter matches nothing. Without this, a custom
    // component on a plugin SETTINGS field renders "Component <Name> not registered by any plugin"
    // in every scope — which is why no plugin had ever shipped one (31 use a custom component on a
    // COLLECTION field, which renders on plugin pages where the bundle does load).
    useEffect(() => {
      const entry = PluginDetailPageService.uiEntryMetadata(plugin);
      if (!entry) return;
      PluginAssetLoaderService.applyOne(entry, {
        // Slots and collections stay owned by the metadata-driven loader. This page is here to
        // administer ONE plugin, and registering its slots from here would put entries on screen for
        // a plugin the current site may not even run.
        registerSlotComponent: () => undefined,
        registerCollection: () => undefined,
      });
    }, [plugin]);

    useEffect(() => {
      const checkUpdates = async () => {
        if (!canManagePlatform) return;
        try {
          const item = await PluginDetailPageService.fetchMarketplaceItem(slug);
          if (item) setMarketplaceItem(item);
        } catch {}
      };

      checkUpdates();
    }, [slug, refreshVersion, canManagePlatform]);

    useEffect(() => {
      setActiveTab(PluginDetailPageService.parseTab(searchParams.get('tab')));
    }, [searchParams]);

    const fetchLogs = async () => {
      if (activeTab !== PluginDetailTab.OVERVIEW || !slug || !canManagePlatform) return;
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
    }, [slug, activeTab, refreshVersion, canManagePlatform]);

    const handleUpdate = async () => {
      if (!plugin) return;
      setIsUpdating(true);
      try {
        const result = await PluginDetailPageService.updatePlugin(plugin.manifest.slug);
        if (result.dependencies.length > 0) {
          notify(NotificationType.INFO, 'Update Dependencies', `This update also requires: ${result.dependencies.join(', ')}`);
        }
        await PluginInstallOperationService.waitForCompletion(result.operationId, setInstallOperation);
        const refreshedPlugin = marketplaceItem?.version
          ? await PluginDetailPageService.waitForInstalledVersion(plugin.manifest.slug, marketplaceItem.version)
          : await PluginDetailPageService.fetchPlugin(plugin.manifest.slug);
        if (refreshedPlugin) {
          setPlugin(refreshedPlugin);
        }
        notify(NotificationType.SUCCESS, 'Update Complete', `${plugin.manifest.name} has been updated to the latest version.`);
        triggerRefresh();
      } catch (error: any) {
        console.error('[PluginDetailPage] Update error:', error);
        notify(NotificationType.ERROR, 'Update Failed', error.message || 'Update failed');
      } finally {
        setInstallOperation(null);
        setIsUpdating(false);
      }
    };

    const handleToggle = async () => {
      if (!plugin) return;
      try {
        const newState = plugin.state === PluginState.ACTIVE ? false : true;
        await PluginDetailPageService.togglePlugin(plugin.manifest.slug, newState);
        const status = newState ? PluginState.ACTIVE : PluginState.INACTIVE;
        setPlugin({
          ...plugin,
          state: status,
          approvedCapabilities: status === PluginState.ACTIVE ? [...(plugin.manifest.capabilities || [])] : plugin.approvedCapabilities,
        });
        notify(NotificationType.SUCCESS, 'Status Updated', `${plugin.manifest.name} is now ${status}.`);
        triggerRefresh();
      } catch (error: any) {
        console.error('[PluginDetailPage] Toggle error:', error);
        notify(NotificationType.ERROR, 'Toggle Failed', error.message || 'Failed to update plugin state.');
      }
    };

    const handleSaveSandbox = async () => {
      if (!plugin) return;
      setIsSaving(true);
      try {
        const nextSandbox = await PluginDetailPageService.saveSandbox(plugin.manifest.slug, sandboxSettings);
        setPlugin({ ...plugin, sandbox: nextSandbox });
        notify(
        NotificationType.SUCCESS,
          'Resources Updated',
          sandboxSettings.enabled
            ? `Sandbox limits for ${plugin.manifest.name} updated.`
            : `Sandbox disabled for ${plugin.manifest.name}.`,
        );
        triggerRefresh();
      } catch (error: any) {
        console.error('[PluginDetailPage] Save sandbox error:', error);
        notify(NotificationType.ERROR, 'Save Failed', error.message || 'Failed to update sandbox limits.');
      } finally {
        setIsSaving(false);
      }
    };

    const handleDelete = async () => {
      if (!plugin) return;
      setIsDeleting(true);
      try {
        await PluginDetailPageService.deletePlugin(plugin.manifest.slug);
        notify(NotificationType.SUCCESS, 'Uninstalled', `${plugin.manifest.name} removed from system.`);
        triggerRefresh();
        router.push('/plugins');
      } catch (error: any) {
        console.error('[PluginDetailPage] Delete error:', error);
        notify(NotificationType.ERROR, 'Uninstall Failed', error.message || 'An error occurred while deleting the plugin.');
        setIsDeleting(false);
        setShowDeleteConfirm(false);
      }
    };

    const handleTabChange = (tabId: PluginDetailTab) => {
      setActiveTab(tabId);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tabId.value);
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
      installOperation,
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
