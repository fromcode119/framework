import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { bound, ref, state } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';
import { InstalledThemesView } from '@/app/themes/installed/components/view/installed-themes-view.client';
import { InstalledThemesPageActions } from '@/app/themes/installed/installed-themes-page-actions';
import { InstalledThemesPageController } from '@/app/themes/installed/installed-themes-page-controller';
import type { IInstalledThemeManifest } from '@/app/themes/installed/interfaces/installed-theme-manifest.interface';
import type { IInstalledThemesPageClientState } from '@/app/themes/installed/interfaces/installed-themes-page-client-state.interface';
import type { IInstalledThemesPageHost } from '@/app/themes/installed/interfaces/installed-themes-page-host.interface';

export class InstalledThemesPageClient
  extends AdminComponent
  implements IInstalledThemesPageHost {
  declare state: IInstalledThemesPageClientState;

  mounted = false;

  @ref declare fileInputRef: Ref<HTMLInputElement>;

  private readonly actions = new InstalledThemesPageActions(this);

  @state themes: IInstalledThemeManifest[] = [];
  @state marketplaceThemes: IInstalledThemeManifest[] = [];
  @state loading = true;
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

  get notify(): INotificationContextType {
    return this.runtime.notify;
  }

  triggerRefresh(): void {
    this.runtime.plugins?.triggerRefresh?.();
  }

  patch(patch: Partial<IInstalledThemesPageClientState>): void {
    this.setState(patch as Pick<IInstalledThemesPageClientState, keyof IInstalledThemesPageClientState>);
  }

  patchWith(updater: (state: IInstalledThemesPageClientState) => Partial<IInstalledThemesPageClientState>): void {
    this.setState((value) => updater(value as IInstalledThemesPageClientState) as Pick<IInstalledThemesPageClientState, keyof IInstalledThemesPageClientState>);
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

  @bound closeUploadPreview(): void {
    this.actions.closeUploadPreview();
  }

  @bound confirmUploadPreview(): Promise<void> {
    return this.actions.confirmUploadPreview();
  }

  @bound handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDropActive = false;
  }

  @bound handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDropActive = true;
  }

  @bound async handleDrop(event: DragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDropActive = false;
    await this.actions.inspectThemeFile(event.dataTransfer.files?.[0]);
  }

  @bound async handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    await this.actions.inspectThemeFile(file);
    if (this.fileInputRef.current) this.fileInputRef.current.value = '';
  }

  @bound handleUploadClick(): void {
    if (this.isUploading || this.isInspectingUpload) return;
    this.fileInputRef.current?.click();
  }

  @bound onActivate(slug: string): Promise<void> {
    return this.actions.activate(slug);
  }

  @bound onDisable(slug: string): Promise<void> {
    return this.actions.disable(slug);
  }

  @bound onDelete(slug: string, isActive: boolean): Promise<void> {
    return this.actions.delete(slug, isActive);
  }

  @bound onUpdate(slug: string): Promise<void> {
    return this.actions.update(slug);
  }

  @bound updateVersionForTheme(installedTheme: IInstalledThemeManifest): string | null {
    return InstalledThemesPageController.resolveUpdateVersion(installedTheme, this.marketplaceThemes);
  }

  render(): ReactNode {
    return (
      <InstalledThemesView
        closeUploadPreview={this.closeUploadPreview}
        confirmUploadPreview={this.confirmUploadPreview}
        fileInputRef={this.fileInputRef}
        handleDragLeave={this.handleDragLeave}
        handleDragOver={this.handleDragOver}
        handleDrop={this.handleDrop}
        handleFileChange={this.handleFileChange}
        handleUploadClick={this.handleUploadClick}
        isDropActive={this.isDropActive}
        isInspectingUpload={this.isInspectingUpload}
        isUploading={this.isUploading}
        loading={this.loading}
        onActivate={this.onActivate}
        onDisable={this.onDisable}
        onDelete={this.onDelete}
        onUpdate={this.onUpdate}
        showUploadPreview={this.showUploadPreview}
        themes={this.themes}
        themeMode={this.theme}
        uploadProgressLabel={this.uploadProgressLabel}
        uploadProgressPercent={this.uploadProgressPercent}
        uploadPreviewDescription={this.uploadPreviewDescription}
        uploadPreviewSections={this.uploadPreviewSections}
        uploadPreviewTitle={this.uploadPreviewTitle}
        updateVersionForTheme={this.updateVersionForTheme}
      />
    );
  }
}
