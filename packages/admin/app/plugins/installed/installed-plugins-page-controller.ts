import type { ILoadedPlugin } from '@fromcode119/core/client';
import { LoadedPluginHydration } from '@fromcode119/core/client';
import { PluginRegistryHealth, PluginState } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { PluginInstallOperationService } from '@/lib/plugin-install-operation-service';
import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';
import { VersionComparisonService } from '@/lib/version-comparison-service';
import { InstalledPluginsUploadService } from '@/app/plugins/installed/installed-plugins-upload-service';
import type { IInstalledPluginMarketplaceItem } from '@/app/plugins/installed/interfaces/installed-plugin-marketplace-item.interface';
import type { IInstalledPluginsArchiveInspection } from '@/app/plugins/installed/interfaces/installed-plugins-archive-inspection.interface';
import type { IPluginReapprovalEntry } from '@/app/plugins/installed/interfaces/plugin-reapproval-entry.interface';

/**
 * Data access + business logic for the installed-plugins page. Hook-free by contract: the page-client
 * class owns React state, lifecycle and notifications; this controller owns "how to fetch/do it".
 */
export class InstalledPluginsPageController {
  private static readonly ARCHIVE_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;
  private static readonly MARKETPLACE_TIMEOUT_MS = 3000;

  /** Installed plugins, forcing a registry refresh so the list reflects the running API. */
  static async fetchPlugins(): Promise<ILoadedPlugin[]> {
    const result = await AdminApi.get(`${AdminConstants.ENDPOINTS.PLUGINS.LIST}?refresh=1`);
    // Hydrate here so `plugin.state === PluginState.ACTIVE` holds downstream — the wire sends strings.
    return LoadedPluginHydration.many<ILoadedPlugin>(result);
  }

  /**
   * Marketplace registry, raced against a timeout — the page must still render installed plugins when
   * the marketplace is slow or unreachable, so callers treat a rejection as "no marketplace data".
   */
  static async fetchMarketplace(): Promise<IInstalledPluginMarketplaceItem[]> {
    const result = await Promise.race([
      AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.MARKETPLACE),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error(`Marketplace timeout after ${InstalledPluginsPageController.MARKETPLACE_TIMEOUT_MS}ms`)),
        InstalledPluginsPageController.MARKETPLACE_TIMEOUT_MS,
      )),
    ]);
    const registry = result as { plugins?: IInstalledPluginMarketplaceItem[] };
    return Array.isArray(registry?.plugins) ? registry.plugins : [];
  }

  /**
   * Stage an archive and inspect it. Returns `supported: false` for a non-archive file so the caller
   * can surface its own message without this class owning notification copy.
   */
  static async inspectArchive(
    file: File,
    onProgress: (label: string, percent: number) => void,
  ): Promise<IInstalledPluginsArchiveInspection> {
    if (!InstalledPluginsUploadService.isSupportedArchive(file)) return { supported: false };

    const uploadId = await InstalledPluginsUploadService.stageArchive(file, {
      chunkSizeBytes: InstalledPluginsPageController.ARCHIVE_CHUNK_SIZE_BYTES,
      onProgress,
    });
    const response = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.UPLOAD_SESSION_INSPECT, { uploadId });
    const info = (response as any)?.info || {};

    return {
      supported: true,
      uploadId,
      previewTitle: `Install plugin "${info.name || info.slug || 'package'}"?`,
      previewDescription: 'Review package contents before continuing.',
      previewSections: InstalledPluginsUploadService.buildPreviewSections(info),
    };
  }

  /** Install a staged archive, reporting operation progress until it completes. */
  static async installArchive(uploadId: string, onStatus: (status: IPluginInstallOperation | null) => void): Promise<void> {
    const operationId = await PluginInstallOperationService.startArchiveInstall(uploadId);
    await PluginInstallOperationService.waitForCompletion(operationId, onStatus);
  }

  /** Install a plugin from the marketplace, reporting operation progress until it completes. */
  static async installFromMarketplace(slug: string, onStatus: (status: IPluginInstallOperation | null) => void): Promise<void> {
    const { operationId } = await PluginInstallOperationService.startMarketplaceInstall(slug);
    await PluginInstallOperationService.waitForCompletion(operationId, onStatus);
  }

  static async toggle(slug: string, enabled: boolean, options: { force?: boolean; recursive?: boolean } = {}): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.TOGGLE(slug), { enabled, ...options });
  }

  /** Re-approve every held plugin. Returns only the entries that failed. */
  static async reapproveAll(): Promise<IPluginReapprovalEntry[]> {
    const result = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.REAPPROVE_ALL, {}) as {
      reapproved?: IPluginReapprovalEntry[];
    };
    return (result?.reapproved || []).filter((entry) => !entry.ok);
  }

  /** Uninstall a plugin, deactivating it first when it is still running. */
  static async deletePlugin(slug: string, plugins: ILoadedPlugin[]): Promise<void> {
    const plugin = plugins.find((value) => value.manifest.slug === slug);
    if (plugin && plugin.state === PluginState.ACTIVE) {
      await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.TOGGLE(slug), { enabled: false });
    }
    await AdminApi.delete(AdminConstants.ENDPOINTS.PLUGINS.DELETE(slug));
  }

  static filterPlugins(plugins: ILoadedPlugin[], searchQuery: string): ILoadedPlugin[] {
    const needle = searchQuery.toLowerCase();
    return plugins.filter((plugin) =>
      (plugin.manifest.name?.toLowerCase() || '').includes(needle) ||
      (plugin.manifest.slug?.toLowerCase() || '').includes(needle),
    );
  }

  static countFailed(plugins: ILoadedPlugin[]): number {
    return plugins.filter((plugin) => plugin.state === PluginState.ERROR || Boolean(plugin.error)).length;
  }

  static countHeld(plugins: ILoadedPlugin[]): number {
    return plugins.filter((plugin) => plugin.healthStatus === PluginRegistryHealth.WARNING || Boolean(plugin.heldReason)).length;
  }

  static hasUpdate(plugin: ILoadedPlugin, marketplaceData: IInstalledPluginMarketplaceItem[]): boolean {
    return marketplaceData.some((entry) =>
      entry.slug === plugin.manifest.slug &&
      VersionComparisonService.isGreater(entry.version, plugin.manifest.version),
    );
  }

  static deleteConfirmDescription(pluginToDelete: string | null, plugins: ILoadedPlugin[]): string {
    const isActive = plugins.find((plugin) => plugin.manifest.slug === pluginToDelete)?.state === PluginState.ACTIVE;
    return `This will permanently remove ${pluginToDelete} and all its data.${isActive ? " Since it's currently active, we'll deactivate it first." : ''}`;
  }

  static reapprovalFailureMessage(failed: IPluginReapprovalEntry[]): string {
    return `${failed.length} plugin${failed.length === 1 ? '' : 's'} could not be re-approved.`;
  }
}
