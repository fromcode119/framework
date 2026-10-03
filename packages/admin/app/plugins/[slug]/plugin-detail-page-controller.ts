import { AuthHooks } from '@/components/view/use-auth.client';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
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
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PluginConsentRequest } from '@/components/plugins/plugin-consent-request';
import type { IPluginConsentSummary } from '@/components/plugins/interfaces/plugin-consent-summary.interface';

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
    // WHERE the operator stands, not only who they are: inside a site the platform's controls for this
    // plugin (its switch for every site, limits, logs across sites, updates, removal) are not shown and not
    // fetched — a site is administered as that site. Unknown until loaded; nothing platform-only runs before.
    const [siteScope, setSiteScope] = useState<boolean | null>(null);
    const platformHere = canManagePlatform && siteScope === false;
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
    const [isolationDefaults, setIsolationDefaults] = useState<{ memoryMb: number; timeoutMs: number } | null>(null);
    // Turning on a plugin that asks for anything not approved opens the consent dialog instead.
    const [consentSlugs, setConsentSlugs] = useState<string[]>([]);
    const [consentInitial, setConsentInitial] = useState<IPluginConsentSummary | null>(null);
    const { theme } = ThemeHooks.useTheme();

    useEffect(() => {
      const loadPlugin = async () => {
        try {
          const [found, locks] = await Promise.all([PluginDetailPageService.fetchPlugin(slug), PlatformSettingLocks.load()]);
          setSiteScope(locks.isSiteScope());
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
        if (!platformHere) return;
        try {
          const item = await PluginDetailPageService.fetchMarketplaceItem(slug);
          if (item) setMarketplaceItem(item);
        } catch {}
      };

      checkUpdates();
    }, [slug, refreshVersion, platformHere]);

    // The sandbox tab's placeholders assert this is what a blank memory/timeout field resolves to;
    // that is only true for the platform's ACTUAL setting, which only a platform admin's own sandbox
    // route can read (site admins never reach this — the sandbox tab itself is platform-only).
    useEffect(() => {
      const loadIsolationDefaults = async () => {
        if (!platformHere) return;
        try {
          setIsolationDefaults(await PluginDetailPageService.fetchIsolationDefaults());
        } catch (error) {
          console.error('[PluginDetailPage] Failed to fetch plugin isolation defaults:', error);
        }
      };

      loadIsolationDefaults();
    }, [platformHere]);

    useEffect(() => {
      setActiveTab(PluginDetailPageService.parseTab(searchParams.get('tab')));
    }, [searchParams]);

    const fetchLogs = async () => {
      if (activeTab !== PluginDetailTab.OVERVIEW || !slug || !platformHere) return;
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
    }, [slug, activeTab, refreshVersion, platformHere]);

    const handleUpdate = async () => {
      if (!plugin) return;
      setIsUpdating(true);
      try {
        const result = await PluginDetailPageService.updatePlugin(plugin.manifest.slug);
        if (result.dependencies.length > 0) {
          notify(NotificationType.INFO, AdminI18n.t('plugins.detail.updateDependencies'), AdminI18n.t('plugins.detail.thisUpdateAlsoRequires', { join: result.dependencies.join(', ') }));
        }
        await PluginInstallOperationService.waitForCompletion(result.operationId, setInstallOperation);
        const refreshedPlugin = marketplaceItem?.version
          ? await PluginDetailPageService.waitForInstalledVersion(plugin.manifest.slug, marketplaceItem.version)
          : await PluginDetailPageService.fetchPlugin(plugin.manifest.slug);
        if (refreshedPlugin) {
          setPlugin(refreshedPlugin);
        }
        notify(NotificationType.SUCCESS, AdminI18n.t('plugins.detail.updateComplete'), AdminI18n.t('plugins.detail.hasBeenUpdatedToThe', { name: plugin.manifest.name }));
        triggerRefresh();
      } catch (error: any) {
        console.error('[PluginDetailPage] Update error:', error);
        notify(NotificationType.ERROR, AdminI18n.t('plugins.detail.updateFailed'), error.message || AdminI18n.t('plugins.detail.updateFailed2'));
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
        notify(NotificationType.SUCCESS, AdminI18n.t('plugins.detail.statusUpdated'), `${plugin.manifest.name} is now ${status}.`);
        triggerRefresh();
      } catch (error: any) {
        const consent = PluginConsentRequest.fromError(error);
        if (consent) { setConsentInitial(consent); setConsentSlugs([consent.slug]); return; }
        console.error('[PluginDetailPage] Toggle error:', error);
        notify(NotificationType.ERROR, AdminI18n.t('plugins.detail.toggleFailed'), error.message || AdminI18n.t('plugins.detail.failedToUpdatePluginState'));
      }
    };

    const handleSaveSandbox = async () => {
      if (!plugin) return;
      setIsSaving(true);
      try {
        const { restartRequired, restartFailed, reason } = await PluginDetailPageService.saveSandbox(plugin.manifest.slug, sandboxSettings);
        // No optimistic write to `plugin` here: the admin reads sandbox state from
        // `plugin.manifest.sandbox`, and `triggerRefresh` below re-fetches the plugin (and this
        // page's own `sandboxSettings`) from the server, which is the only place that value lives.
        if (restartFailed) {
          // The row IS saved — do not call this a failure — but the live reload attempt killed the
          // guest and it did not come back up. Surface the reason; do not schedule a retry ourselves.
          notify(NotificationType.ERROR, AdminI18n.t('plugins.detail.restartFailed'), AdminI18n.t('plugins.detail.sandboxLimitsForWereSaved', { name: plugin.manifest.name, value: reason || AdminI18n.t('common.unknownError') }));
        } else if (restartRequired) {
          notify(NotificationType.INFO, AdminI18n.t('plugins.detail.restartRequired'), AdminI18n.t('plugins.detail.sandboxSettingsForWereSaved', { name: plugin.manifest.name }));
        } else {
          notify(
            NotificationType.SUCCESS,
            AdminI18n.t('plugins.detail.resourcesUpdated'),
            AdminI18n.t('plugins.detail.sandboxLimitsForUpdated', { name: plugin.manifest.name }),
          );
        }
        triggerRefresh();
      } catch (error: any) {
        console.error('[PluginDetailPage] Save sandbox error:', error);
        notify(NotificationType.ERROR, AdminI18n.t('plugins.detail.saveFailed'), error.message || AdminI18n.t('plugins.detail.failedToUpdateSandboxLimits'));
      } finally {
        setIsSaving(false);
      }
    };

    const handleDelete = async () => {
      if (!plugin) return;
      setIsDeleting(true);
      try {
        await PluginDetailPageService.deletePlugin(plugin.manifest.slug);
        notify(NotificationType.SUCCESS, AdminI18n.t('plugins.detail.uninstalled'), AdminI18n.t('plugins.detail.removedFromSystem', { name: plugin.manifest.name }));
        triggerRefresh();
        router.push('/plugins');
      } catch (error: any) {
        console.error('[PluginDetailPage] Delete error:', error);
        notify(NotificationType.ERROR, AdminI18n.t('plugins.detail.uninstallFailed'), error.message || AdminI18n.t('plugins.detail.anErrorOccurredWhileDeleting'));
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

    const consentFinished = async () => {
      setConsentSlugs([]);
      setConsentInitial(null);
      setPlugin((await PluginDetailPageService.fetchPlugin(slug)) || plugin);
      triggerRefresh();
    };

    return {
      consentSlugs,
      consentInitial,
      consentFinished,
      activeTab,
      siteScope: siteScope === true,
      fetchLogs,
      handleDelete,
      handleSaveSandbox,
      handleTabChange,
      handleToggle,
      handleUpdate,
      installOperation,
      isDeleting,
      isolationDefaults,
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
