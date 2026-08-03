import React from 'react';
import type { ReactNode } from 'react';
import { state } from '@fromcode119/reactor';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import { IDependencyIssue } from '@/components/ui/interfaces/dependency-issue.interface';
import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';
import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';
import { InstalledPluginsView } from '@/app/plugins/installed/components/view/installed-plugins-view.client';
import { InstalledPluginsPageActions } from '@/app/plugins/installed/installed-plugins-page-actions';
import { InstalledPluginsPageController } from '@/app/plugins/installed/installed-plugins-page-controller';
import type { IInstalledPluginMarketplaceItem } from '@/app/plugins/installed/interfaces/installed-plugin-marketplace-item.interface';
import type { IInstalledPluginsPageClientState } from '@/app/plugins/installed/interfaces/installed-plugins-page-client-state.interface';
import type { IInstalledPluginsPageHost } from '@/app/plugins/installed/interfaces/installed-plugins-page-host.interface';

export class InstalledPluginsPageClient
  extends AdminComponent
  implements IInstalledPluginsPageHost {
  declare state: IInstalledPluginsPageClientState;

  mounted = false;

  private prevRefreshVersion: any = undefined;
  private readonly fileInputRef = React.createRef<HTMLInputElement>();
  private readonly actions = new InstalledPluginsPageActions(this);

  @state plugins: ILoadedPlugin[] = [];
  @state marketplaceData: IInstalledPluginMarketplaceItem[] = [];
  @state loading = true;
  @state searchQuery = '';
  @state showDeleteConfirm = false;
  @state showDependencyConfirm = false;
  @state dependencyIssues: IDependencyIssue[] = [];
  @state targetPlugin: string | null = null;
  @state pluginToDelete: string | null = null;
  @state isDeleting = false;
  @state isActivating = false;
  @state isUploading = false;
  @state isInspectingUpload = false;
  @state isDropActive = false;
  @state pendingUploadId: string | null = null;
  @state uploadProgressLabel: string | null = null;
  @state uploadProgressPercent: number | null = null;
  @state showUploadPreview = false;
  @state uploadPreviewTitle = '';
  @state uploadPreviewDescription = '';
  @state uploadPreviewSections: IUploadPreviewSection[] = [];
  @state operationStatus: IPluginInstallOperation | null = null;
  @state imageErrors: Record<string, boolean> = {};

  get notify(): INotificationContextType {
    return this.runtime.notify;
  }

  triggerRefresh(): void {
    this.runtime.plugins?.triggerRefresh?.();
  }

  patch(patch: Partial<IInstalledPluginsPageClientState>): void {
    this.setState(patch as never);
  }

  patchWith(updater: (state: IInstalledPluginsPageClientState) => Partial<IInstalledPluginsPageClientState>): void {
    this.setState(((value: IInstalledPluginsPageClientState) => updater(value)) as never);
  }

  refresh(): Promise<void> {
    return this.actions.fetchPlugins();
  }

  componentDidMount(): void {
    this.mounted = true;
    this.prevRefreshVersion = this.runtime.plugins?.refreshVersion;
    void this.actions.fetchPlugins();
  }

  /** Mirrors the original `useEffect(..., [refreshVersion])`. */
  componentDidUpdate(): void {
    if (this.runtime.plugins?.refreshVersion !== this.prevRefreshVersion) {
      this.prevRefreshVersion = this.runtime.plugins?.refreshVersion;
      void this.actions.fetchPlugins();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  render(): ReactNode {
    return (
      <InstalledPluginsView
        closeDeleteConfirm={() => {
          this.showDeleteConfirm = false;
          this.pluginToDelete = null;
        }}
        closeDependencyConfirm={() => {
          this.showDependencyConfirm = false;
          this.targetPlugin = null;
        }}
        closeUploadPreview={() => this.actions.closeUploadPreview()}
        confirmUploadPreview={() => this.actions.confirmUploadPreview()}
        deleteConfirmDescription={InstalledPluginsPageController.deleteConfirmDescription(this.pluginToDelete, this.plugins)}
        dependencyIssues={this.dependencyIssues}
        failedPluginsCount={InstalledPluginsPageController.countFailed(this.plugins)}
        heldPluginsCount={InstalledPluginsPageController.countHeld(this.plugins)}
        onReapproveAll={() => this.actions.reapproveAll()}
        filteredPlugins={InstalledPluginsPageController.filterPlugins(this.plugins, this.searchQuery)}
        fileInputRef={this.fileInputRef}
        handleDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          this.isDropActive = false;
        }}
        handleDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          this.isDropActive = true;
        }}
        handleDrop={async (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.isDropActive = false;
          await this.actions.inspectPluginFile(event.dataTransfer.files?.[0]);
        }}
        handleFileChange={async (event) => {
          const file = event.target.files?.[0];
          await this.actions.inspectPluginFile(file);
          if (this.fileInputRef.current) this.fileInputRef.current.value = '';
        }}
        hasPluginUpdate={(plugin) => InstalledPluginsPageController.hasUpdate(plugin, this.marketplaceData)}
        handleToggle={(slug, currentEnabled, options) => this.actions.handleToggle(slug, currentEnabled, options)}
        handleUploadClick={() => {
          if (this.isUploading || this.isInspectingUpload) return;
          this.fileInputRef.current?.click();
        }}
        imageErrors={this.imageErrors}
        isActivating={this.isActivating}
        isDeleting={this.isDeleting}
        isDropActive={this.isDropActive}
        isInspectingUpload={this.isInspectingUpload}
        isUploading={this.isUploading}
        loading={this.loading}
        operationStatus={this.operationStatus}
        markImageError={(slug) => {
          this.imageErrors = { ...this.imageErrors, [slug]: true };
        }}
        onDeleteConfirm={() => this.actions.deleteConfirmed()}
        onDeletePrompt={(slug) => {
          this.pluginToDelete = slug;
          this.showDeleteConfirm = true;
        }}
        searchQuery={this.searchQuery}
        setSearchQuery={(value) => {
          this.searchQuery = value;
        }}
        showDeleteConfirm={this.showDeleteConfirm}
        showDependencyConfirm={this.showDependencyConfirm}
        showUploadPreview={this.showUploadPreview}
        targetPlugin={this.targetPlugin}
        theme={this.theme}
        toggleDependencies={(recursive, force) => this.actions.toggleDependencies(recursive, force)}
        uploadProgressLabel={this.uploadProgressLabel}
        uploadProgressPercent={this.uploadProgressPercent}
        uploadPreviewDescription={this.uploadPreviewDescription}
        uploadPreviewSections={this.uploadPreviewSections}
        uploadPreviewTitle={this.uploadPreviewTitle}
      />
    );
  }
}
