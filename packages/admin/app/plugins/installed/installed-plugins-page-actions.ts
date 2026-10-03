import { DependencyIssueType } from '@/components/ui/enums/dependency-issue-type.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { PluginState } from '@fromcode119/core/client';
import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';
import { InstalledPluginsPageController } from '@/app/plugins/installed/installed-plugins-page-controller';
import type { IInstalledPluginsPageClientState } from '@/app/plugins/installed/interfaces/installed-plugins-page-client-state.interface';
import type { IInstalledPluginsPageHost } from '@/app/plugins/installed/interfaces/installed-plugins-page-host.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PluginConsentRequest } from '@/components/plugins/plugin-consent-request';

/**
 * Orchestration for the installed-plugins page: binds {@link InstalledPluginsPageController} I/O to
 * the page-client's state and notifications. Hook-free — it only touches React through the host.
 */
export class InstalledPluginsPageActions {
  constructor(private readonly host: IInstalledPluginsPageHost) {}

  private clearUploadProgress(): void {
    if (!this.host.mounted) return;
    this.host.patch({ uploadProgressLabel: null, uploadProgressPercent: null });
  }

  private setOperationStatus(status: IPluginInstallOperation | null): void {
    if (this.host.mounted) this.host.patch({ operationStatus: status });
  }

  /** Installed list first (it gates `loading`), then the marketplace as a best-effort enrichment. */
  async fetchPlugins(): Promise<void> {
    this.host.patch({ loading: true });
    try {
      const plugins = await InstalledPluginsPageController.fetchPlugins();
      if (this.host.mounted) this.host.patch({ plugins });
    } catch (error) {
      console.error('[InstalledPluginsPage] Failed to fetch installed plugins:', error);
      if (this.host.mounted) this.host.patch({ plugins: [] });
    } finally {
      if (this.host.mounted) this.host.patch({ loading: false });
    }

    // A tenant admin never asks the marketplace: the route is platform-only (403), and a page that
    // fires a request it is not allowed to make is a bug, not a graceful degradation.
    if (!this.host.canManage) {
      if (this.host.mounted) this.host.patch({ marketplaceData: [] });
      return;
    }

    try {
      const marketplaceData = await InstalledPluginsPageController.fetchMarketplace();
      if (this.host.mounted) this.host.patch({ marketplaceData });
    } catch (error) {
      console.warn('[InstalledPluginsPage] Marketplace unavailable, continuing with installed plugins only:', error);
      if (this.host.mounted) this.host.patch({ marketplaceData: [] });
    }
  }

  private async uploadPluginFile(uploadId?: string | null): Promise<void> {
    if (!uploadId) return;
    const { notify } = this.host.notify;

    this.host.patch({ isUploading: true });
    try {
      await InstalledPluginsPageController.installArchive(uploadId, (status) => this.setOperationStatus(status));
      notify(NotificationType.SUCCESS, AdminI18n.t('plugins.list.uploadSuccessful'), AdminI18n.t('plugins.list.pluginUploadedSuccessfully'));
      await this.host.refresh();
      // Installed, not running: what it asks for is approved next, in the consent dialog.
      const slug = this.host.state.pendingUploadSlug;
      if (slug && this.host.mounted) this.host.patch({ consentSlugs: [slug], consentInitial: null });
    } catch (error: any) {
      notify(NotificationType.ERROR, AdminI18n.t('plugins.list.uploadFailed'), error.message);
    } finally {
      if (this.host.mounted) this.host.patch({ operationStatus: null, isUploading: false });
      this.clearUploadProgress();
    }
  }

  async inspectPluginFile(file?: File | null): Promise<void> {
    if (!file) return;
    const { notify } = this.host.notify;
    this.host.patch({ isInspectingUpload: true });

    try {
      const inspection = await InstalledPluginsPageController.inspectArchive(file, (label, percent) => {
        if (this.host.mounted) this.host.patch({ uploadProgressLabel: label, uploadProgressPercent: percent });
      });
      if (!inspection.supported) {
        notify(NotificationType.ERROR, AdminI18n.t('plugins.list.uploadFailed'), AdminI18n.t('plugins.list.onlyZipOrTarGz'));
        return;
      }
      if (!this.host.mounted) return;
      this.host.patch({
        uploadPreviewTitle: inspection.previewTitle ?? '',
        uploadPreviewDescription: inspection.previewDescription ?? '',
        uploadPreviewSections: inspection.previewSections ?? [],
        pendingUploadId: inspection.uploadId ?? null,
        pendingUploadSlug: inspection.slug || null,
        showUploadPreview: true,
      });
    } catch (error: any) {
      if (this.host.mounted) this.host.patch({ pendingUploadId: null });
      notify(NotificationType.ERROR, AdminI18n.t('plugins.list.inspectFailed'), error.message || AdminI18n.t('plugins.list.couldNotInspectPluginPackage'));
      this.clearUploadProgress();
    } finally {
      if (this.host.mounted) this.host.patch({ isInspectingUpload: false });
    }
  }

  closeUploadPreview(): void {
    if (this.host.state.isUploading) return;
    this.host.patch({ showUploadPreview: false, pendingUploadId: null });
    this.clearUploadProgress();
  }

  async confirmUploadPreview(): Promise<void> {
    const { pendingUploadId } = this.host.state;
    if (!pendingUploadId) return;
    await this.uploadPluginFile(pendingUploadId);
    if (this.host.mounted) this.host.patch({ showUploadPreview: false, pendingUploadId: null });
  }

  async handleToggle(slug: string, currentEnabled: boolean, options: { force?: boolean; recursive?: boolean } = {}): Promise<void> {
    const { notify } = this.host.notify;
    try {
      if (!currentEnabled) this.host.patch({ isActivating: true });
      await InstalledPluginsPageController.toggle(slug, !currentEnabled, options);
      notify(NotificationType.SUCCESS, AdminI18n.t('plugins.list.pluginUpdated'), `${slug} is now ${!currentEnabled ? 'active' : 'inactive'}.`);
      this.host.patchWith((value: IInstalledPluginsPageClientState) => ({
        plugins: value.plugins.map((plugin) => plugin.manifest.slug === slug
          ? { ...plugin, state: !currentEnabled ? PluginState.ACTIVE : PluginState.INACTIVE }
          : plugin),
      }));
      if (options.recursive || options.force) {
        this.host.patch({ showDependencyConfirm: false });
        await this.host.refresh();
      }
      this.host.triggerRefresh();
    } catch (error: any) {
      const consent = PluginConsentRequest.fromError(error);
      if (consent) {
        this.host.patch({ consentSlugs: [slug], consentInitial: consent });
      } else if (error.status === 409 && error.data?.issues) {
        // Hydrate `type` at the fetch boundary: `IDependencyIssue.type` is DECLARED as the enum but the
        // 409 body carries a plain string, so `issue.type.value` in DependencyDialog was `undefined`
        // and `.toUpperCase()` on it threw — the dialog crashed for every non-"missing" issue.
        const issues = (Array.isArray(error.data.issues) ? error.data.issues : [])
          .map((issue: any) => ({ ...issue, type: DependencyIssueType.resolve(issue?.type) }));
        this.host.patch({ dependencyIssues: issues, targetPlugin: slug, showDependencyConfirm: true });
      } else {
        notify(NotificationType.ERROR, AdminI18n.t('plugins.list.updateFailed'), error.message);
      }
    } finally {
      if (this.host.mounted) this.host.patch({ isActivating: false });
    }
  }

  /** One consent dialog per held plugin, in turn. */
  reapproveAll(): void {
    this.host.patch({ consentSlugs: InstalledPluginsPageController.heldSlugs(this.host.state.plugins), consentInitial: null });
  }

  /** The consent dialogs are done: show what is now running. */
  async consentFinished(): Promise<void> {
    this.host.patch({ consentSlugs: [], consentInitial: null });
    await this.host.refresh();
    this.host.triggerRefresh();
  }

  async deleteConfirmed(): Promise<void> {
    const { notify } = this.host.notify;
    const { pluginToDelete, plugins } = this.host.state;
    if (!pluginToDelete) return;
    this.host.patch({ isDeleting: true });
    try {
      await InstalledPluginsPageController.deletePlugin(pluginToDelete, plugins);
      notify(NotificationType.SUCCESS, AdminI18n.t('plugins.list.deleted'), AdminI18n.t('plugins.list.pluginRemoved', { pluginToDelete: pluginToDelete }));
      this.host.patchWith((value: IInstalledPluginsPageClientState) => ({
        plugins: value.plugins.filter((entry) => entry.manifest.slug !== pluginToDelete),
        showDeleteConfirm: false,
      }));
      this.host.triggerRefresh();
    } catch (error: any) {
      notify(NotificationType.ERROR, AdminI18n.t('plugins.list.deleteFailed'), error.message);
    } finally {
      if (this.host.mounted) this.host.patch({ isDeleting: false, pluginToDelete: null });
    }
  }

  /** Install any missing dependencies first (when recursive), then retry the activation. */
  async toggleDependencies(recursive: boolean, force: boolean): Promise<void> {
    const { notify } = this.host.notify;
    const { targetPlugin, dependencyIssues } = this.host.state;
    if (!targetPlugin) return;
    if (recursive) {
      const missing = dependencyIssues.filter((issue) => String(issue.type) === DependencyIssueType.MISSING.value);
      for (const issue of missing) {
        notify(NotificationType.INFO, AdminI18n.t('plugins.list.dependencyInstall'), AdminI18n.t('plugins.list.downloadingFromMarketplace', { slug: issue.slug }));
        try {
          await InstalledPluginsPageController.installFromMarketplace(issue.slug, (status) => this.setOperationStatus(status));
        } catch (error: any) {
          notify(NotificationType.ERROR, AdminI18n.t('plugins.list.autoInstallFailed'), AdminI18n.t('plugins.list.couldNotInstall', { slug: issue.slug, message: error.message }));
          this.setOperationStatus(null);
          return;
        }
      }
    }
    await this.handleToggle(targetPlugin, false, { recursive, force });
  }
}
