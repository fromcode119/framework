import { DependencyIssueType } from '@/components/ui/enums/dependency-issue-type.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { PluginState } from '@fromcode119/core/client';
import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';
import { InstalledPluginsPageController } from '@/app/plugins/installed/installed-plugins-page-controller';
import type { IInstalledPluginsPageClientState } from '@/app/plugins/installed/interfaces/installed-plugins-page-client-state.interface';
import type { IInstalledPluginsPageHost } from '@/app/plugins/installed/interfaces/installed-plugins-page-host.interface';

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
      notify(NotificationType.SUCCESS, 'Upload Successful', 'Plugin uploaded successfully.');
      await this.host.refresh();
    } catch (error: any) {
      notify(NotificationType.ERROR, 'Upload Failed', error.message);
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
        notify(NotificationType.ERROR, 'Upload Failed', 'Only .zip or .tar.gz plugin packages are supported.');
        return;
      }
      if (!this.host.mounted) return;
      this.host.patch({
        uploadPreviewTitle: inspection.previewTitle ?? '',
        uploadPreviewDescription: inspection.previewDescription ?? '',
        uploadPreviewSections: inspection.previewSections ?? [],
        pendingUploadId: inspection.uploadId ?? null,
        showUploadPreview: true,
      });
    } catch (error: any) {
      if (this.host.mounted) this.host.patch({ pendingUploadId: null });
      notify(NotificationType.ERROR, 'Inspect Failed', error.message || 'Could not inspect plugin package.');
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
      notify(NotificationType.SUCCESS, 'Plugin Updated', `${slug} is now ${!currentEnabled ? 'active' : 'inactive'}.`);
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
      if (error.status === 409 && error.data?.issues) {
        this.host.patch({ dependencyIssues: error.data.issues, targetPlugin: slug, showDependencyConfirm: true });
      } else {
        notify(NotificationType.ERROR, 'Update Failed', error.message);
      }
    } finally {
      if (this.host.mounted) this.host.patch({ isActivating: false });
    }
  }

  async reapproveAll(): Promise<void> {
    const { notify } = this.host.notify;
    this.host.patch({ isActivating: true });
    try {
      const failed = await InstalledPluginsPageController.reapproveAll();
      if (failed.length > 0) {
        notify(NotificationType.ERROR, 'Re-approval Incomplete', InstalledPluginsPageController.reapprovalFailureMessage(failed));
      } else {
        notify(NotificationType.SUCCESS, 'Plugins Re-approved', 'All held plugins have been re-approved and enabled.');
      }
      await this.host.refresh();
      this.host.triggerRefresh();
    } catch (error: any) {
      notify(NotificationType.ERROR, 'Re-approval Failed', error.message);
    } finally {
      if (this.host.mounted) this.host.patch({ isActivating: false });
    }
  }

  async deleteConfirmed(): Promise<void> {
    const { notify } = this.host.notify;
    const { pluginToDelete, plugins } = this.host.state;
    if (!pluginToDelete) return;
    this.host.patch({ isDeleting: true });
    try {
      await InstalledPluginsPageController.deletePlugin(pluginToDelete, plugins);
      notify(NotificationType.SUCCESS, 'Deleted', `Plugin ${pluginToDelete} removed.`);
      this.host.patchWith((value: IInstalledPluginsPageClientState) => ({
        plugins: value.plugins.filter((entry) => entry.manifest.slug !== pluginToDelete),
        showDeleteConfirm: false,
      }));
      this.host.triggerRefresh();
    } catch (error: any) {
      notify(NotificationType.ERROR, 'Delete Failed', error.message);
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
        notify(NotificationType.INFO, 'Dependency Install', `Downloading ${issue.slug} from marketplace...`);
        try {
          await InstalledPluginsPageController.installFromMarketplace(issue.slug, (status) => this.setOperationStatus(status));
        } catch (error: any) {
          notify(NotificationType.ERROR, 'Auto-Install Failed', `Could not install ${issue.slug}: ${error.message}`);
          this.setOperationStatus(null);
          return;
        }
      }
    }
    await this.handleToggle(targetPlugin, false, { recursive, force });
  }
}
