"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import type { NotificationContextType } from '@/components/notification-context.interfaces';
import InstalledPluginsView from './components/installed-plugins-view';
import { InstalledPluginsPageActions } from './installed-plugins-page-actions';
import { InstalledPluginsPageController } from './installed-plugins-page-controller';
import type {
  InstalledPluginsPageClientState,
  InstalledPluginsPageHost,
} from './installed-plugins-page.interfaces';

export default class InstalledPluginsPageClient
  extends AdminComponent<Record<string, never>, InstalledPluginsPageClientState>
  implements InstalledPluginsPageHost {
  mounted = false;

  private prevRefreshVersion: any = undefined;
  private readonly fileInputRef = React.createRef<HTMLInputElement>();
  private readonly actions = new InstalledPluginsPageActions(this);

  state: InstalledPluginsPageClientState = {
    plugins: [],
    marketplaceData: [],
    loading: true,
    searchQuery: '',
    showDeleteConfirm: false,
    showDependencyConfirm: false,
    dependencyIssues: [],
    targetPlugin: null,
    pluginToDelete: null,
    isDeleting: false,
    isActivating: false,
    isUploading: false,
    isInspectingUpload: false,
    isDropActive: false,
    pendingUploadId: null,
    uploadProgressLabel: null,
    uploadProgressPercent: null,
    showUploadPreview: false,
    uploadPreviewTitle: '',
    uploadPreviewDescription: '',
    uploadPreviewSections: [],
    operationStatus: null,
    imageErrors: {},
  };

  get notify(): NotificationContextType {
    return this.runtime.notify;
  }

  triggerRefresh(): void {
    this.runtime.plugins?.triggerRefresh?.();
  }

  patch(patch: Partial<InstalledPluginsPageClientState>): void {
    this.setState(patch as Pick<InstalledPluginsPageClientState, keyof InstalledPluginsPageClientState>);
  }

  patchWith(updater: (state: InstalledPluginsPageClientState) => Partial<InstalledPluginsPageClientState>): void {
    this.setState((value) => updater(value) as Pick<InstalledPluginsPageClientState, keyof InstalledPluginsPageClientState>);
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

  render(): React.ReactNode {
    const {
      plugins,
      marketplaceData,
      loading,
      searchQuery,
      showDeleteConfirm,
      showDependencyConfirm,
      dependencyIssues,
      targetPlugin,
      pluginToDelete,
      isDeleting,
      isActivating,
      isUploading,
      isInspectingUpload,
      isDropActive,
      uploadProgressLabel,
      uploadProgressPercent,
      showUploadPreview,
      uploadPreviewTitle,
      uploadPreviewDescription,
      uploadPreviewSections,
      operationStatus,
      imageErrors,
    } = this.state;

    return (
      <InstalledPluginsView
        closeDeleteConfirm={() => this.setState({ showDeleteConfirm: false, pluginToDelete: null })}
        closeDependencyConfirm={() => this.setState({ showDependencyConfirm: false, targetPlugin: null })}
        closeUploadPreview={() => this.actions.closeUploadPreview()}
        confirmUploadPreview={() => this.actions.confirmUploadPreview()}
        deleteConfirmDescription={InstalledPluginsPageController.deleteConfirmDescription(pluginToDelete, plugins)}
        dependencyIssues={dependencyIssues}
        failedPluginsCount={InstalledPluginsPageController.countFailed(plugins)}
        heldPluginsCount={InstalledPluginsPageController.countHeld(plugins)}
        onReapproveAll={() => this.actions.reapproveAll()}
        filteredPlugins={InstalledPluginsPageController.filterPlugins(plugins, searchQuery)}
        fileInputRef={this.fileInputRef}
        handleDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          this.setState({ isDropActive: false });
        }}
        handleDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          this.setState({ isDropActive: true });
        }}
        handleDrop={async (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.setState({ isDropActive: false });
          await this.actions.inspectPluginFile(event.dataTransfer.files?.[0]);
        }}
        handleFileChange={async (event) => {
          const file = event.target.files?.[0];
          await this.actions.inspectPluginFile(file);
          if (this.fileInputRef.current) this.fileInputRef.current.value = '';
        }}
        hasPluginUpdate={(plugin) => InstalledPluginsPageController.hasUpdate(plugin, marketplaceData)}
        handleToggle={(slug, currentEnabled, options) => this.actions.handleToggle(slug, currentEnabled, options)}
        handleUploadClick={() => {
          if (isUploading || isInspectingUpload) return;
          this.fileInputRef.current?.click();
        }}
        imageErrors={imageErrors}
        isActivating={isActivating}
        isDeleting={isDeleting}
        isDropActive={isDropActive}
        isInspectingUpload={isInspectingUpload}
        isUploading={isUploading}
        loading={loading}
        operationStatus={operationStatus}
        markImageError={(slug) => this.setState((value) => ({ imageErrors: { ...value.imageErrors, [slug]: true } }))}
        onDeleteConfirm={() => this.actions.deleteConfirmed()}
        onDeletePrompt={(slug) => this.setState({ pluginToDelete: slug, showDeleteConfirm: true })}
        searchQuery={searchQuery}
        setSearchQuery={(value) => this.setState({ searchQuery: value })}
        showDeleteConfirm={showDeleteConfirm}
        showDependencyConfirm={showDependencyConfirm}
        showUploadPreview={showUploadPreview}
        targetPlugin={targetPlugin}
        theme={this.theme}
        toggleDependencies={(recursive, force) => this.actions.toggleDependencies(recursive, force)}
        uploadProgressLabel={uploadProgressLabel}
        uploadProgressPercent={uploadProgressPercent}
        uploadPreviewDescription={uploadPreviewDescription}
        uploadPreviewSections={uploadPreviewSections}
        uploadPreviewTitle={uploadPreviewTitle}
      />
    );
  }
}
