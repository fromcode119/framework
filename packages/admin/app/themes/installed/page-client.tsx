"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import type { NotificationContextType } from '@/components/notification-context.interfaces';
import InstalledThemesView from './components/installed-themes-view';
import { InstalledThemesPageActions } from './installed-themes-page-actions';
import { InstalledThemesPageController } from './installed-themes-page-controller';
import type {
  InstalledThemeManifest,
  InstalledThemesPageClientState,
  InstalledThemesPageHost,
} from './installed-themes-page.interfaces';

export default class InstalledThemesPageClient
  extends AdminComponent<Record<string, never>, InstalledThemesPageClientState>
  implements InstalledThemesPageHost {
  mounted = false;

  private readonly fileInputRef = React.createRef<HTMLInputElement>();
  private readonly actions = new InstalledThemesPageActions(this);

  state: InstalledThemesPageClientState = {
    themes: [],
    marketplaceThemes: [],
    loading: true,
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
  };

  get notify(): NotificationContextType {
    return this.runtime.notify;
  }

  triggerRefresh(): void {
    this.runtime.plugins?.triggerRefresh?.();
  }

  patch(patch: Partial<InstalledThemesPageClientState>): void {
    this.setState(patch as Pick<InstalledThemesPageClientState, keyof InstalledThemesPageClientState>);
  }

  patchWith(updater: (state: InstalledThemesPageClientState) => Partial<InstalledThemesPageClientState>): void {
    this.setState((value) => updater(value) as Pick<InstalledThemesPageClientState, keyof InstalledThemesPageClientState>);
  }

  refresh(): Promise<void> {
    return this.actions.fetchThemes();
  }

  componentDidMount(): void {
    this.mounted = true;
    void this.actions.fetchThemes();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  render(): React.ReactNode {
    const {
      themes,
      marketplaceThemes,
      loading,
      isUploading,
      isInspectingUpload,
      isDropActive,
      showUploadPreview,
      uploadProgressLabel,
      uploadProgressPercent,
      uploadPreviewTitle,
      uploadPreviewDescription,
      uploadPreviewSections,
    } = this.state;

    return (
      <InstalledThemesView
        closeUploadPreview={() => this.actions.closeUploadPreview()}
        confirmUploadPreview={() => this.actions.confirmUploadPreview()}
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
          await this.actions.inspectThemeFile(event.dataTransfer.files?.[0]);
        }}
        handleFileChange={async (event) => {
          const file = event.target.files?.[0];
          await this.actions.inspectThemeFile(file);
          if (this.fileInputRef.current) this.fileInputRef.current.value = '';
        }}
        handleUploadClick={() => {
          if (isUploading || isInspectingUpload) return;
          this.fileInputRef.current?.click();
        }}
        isDropActive={isDropActive}
        isInspectingUpload={isInspectingUpload}
        isUploading={isUploading}
        loading={loading}
        onActivate={(slug) => this.actions.activate(slug)}
        onDisable={(slug) => this.actions.disable(slug)}
        onDelete={(slug, isActive) => this.actions.delete(slug, isActive)}
        onUpdate={(slug) => this.actions.update(slug)}
        showUploadPreview={showUploadPreview}
        themes={themes}
        themeMode={this.theme}
        uploadProgressLabel={uploadProgressLabel}
        uploadProgressPercent={uploadProgressPercent}
        uploadPreviewDescription={uploadPreviewDescription}
        uploadPreviewSections={uploadPreviewSections}
        uploadPreviewTitle={uploadPreviewTitle}
        updateVersionForTheme={(installedTheme: InstalledThemeManifest) =>
          InstalledThemesPageController.resolveUpdateVersion(installedTheme, marketplaceThemes)}
      />
    );
  }
}
