import { NotificationType } from '@/components/enums/notification-type.enum';
import { ThemeState } from '@fromcode119/core/client';
import { InstalledThemesPageController } from '@/app/themes/installed/installed-themes-page-controller';
import type { IInstalledThemesPageHost } from '@/app/themes/installed/interfaces/installed-themes-page-host.interface';
/**
 * Orchestration for the installed-themes page: binds {@link InstalledThemesPageController} I/O to the
 * page-client's state and notifications. Hook-free — it only ever touches React through the host.
 */
export class InstalledThemesPageActions {
  constructor(private readonly host: IInstalledThemesPageHost) {}

  private clearUploadProgress(): void {
    if (!this.host.mounted) return;
    this.host.patch({ uploadProgressLabel: null, uploadProgressPercent: null });
  }

  async fetchThemes(): Promise<void> {
    const { notify } = this.host.notify;
    this.host.patch({ loading: true });
    try {
      const { themes, marketplaceThemes } = await InstalledThemesPageController.fetchThemes();
      if (!this.host.mounted) return;
      this.host.patch({ themes, marketplaceThemes });
    } catch (error) {
      console.error('[InstalledThemesPage] Failed to fetch themes:', error);
      notify(NotificationType.ERROR, 'Fetch Failed', 'Could not load themes.');
    } finally {
      if (this.host.mounted) this.host.patch({ loading: false });
    }
  }

  private async uploadThemeFile(uploadId?: string | null): Promise<void> {
    if (!uploadId) return;
    const { notify } = this.host.notify;

    this.host.patch({ isUploading: true });
    try {
      await InstalledThemesPageController.completeUpload(uploadId);
      notify(NotificationType.SUCCESS, 'Upload Successful', 'Theme uploaded successfully.');
      await this.host.refresh();
      this.host.triggerRefresh();
    } catch (error: any) {
      notify(NotificationType.ERROR, 'Upload Failed', error.message);
    } finally {
      if (this.host.mounted) this.host.patch({ isUploading: false });
      this.clearUploadProgress();
    }
  }

  async inspectThemeFile(file?: File | null): Promise<void> {
    if (!file) return;
    const { notify } = this.host.notify;
    this.host.patch({ isInspectingUpload: true });

    try {
      const inspection = await InstalledThemesPageController.inspectArchive(file, (label, percent) => {
        if (this.host.mounted) this.host.patch({ uploadProgressLabel: label, uploadProgressPercent: percent });
      });
      if (!inspection.supported) {
        notify(NotificationType.ERROR, 'Upload Failed', 'Only .zip or .tar.gz theme packages are supported.');
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
      notify(NotificationType.ERROR, 'Inspect Failed', error.message || 'Could not inspect theme package.');
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
    await this.uploadThemeFile(pendingUploadId);
    if (this.host.mounted) this.host.patch({ showUploadPreview: false, pendingUploadId: null });
  }

  async activate(slug: string): Promise<void> {
    const { notify } = this.host.notify;
    try {
      await InstalledThemesPageController.activate(slug);
      notify(NotificationType.SUCCESS, 'Theme Activated', `${slug} is now the active theme.`);
      this.host.patchWith((value) => ({
        themes: value.themes.map((item) => ({ ...item, state: item.slug === slug ? ThemeState.ACTIVE : ThemeState.INACTIVE })),
      }));
      this.host.triggerRefresh();
    } catch (error: any) {
      notify(NotificationType.ERROR, 'Activation Failed', error.message);
    }
  }

  async disable(slug: string): Promise<void> {
    const { notify } = this.host.notify;
    if (!confirm(InstalledThemesPageController.disableConfirmationMessage(slug))) return;

    try {
      await InstalledThemesPageController.disable(slug);
      notify(NotificationType.SUCCESS, 'Theme Disabled', `${slug} is no longer active.`);
      this.host.patchWith((value) => ({ themes: value.themes.map((item) => ({ ...item, state: ThemeState.INACTIVE })) }));
      this.host.triggerRefresh();
    } catch (error: any) {
      notify(NotificationType.ERROR, 'Disable Failed', error.message);
    }
  }

  async delete(slug: string, isActive: boolean): Promise<void> {
    const { notify } = this.host.notify;
    if (!confirm(InstalledThemesPageController.deleteConfirmationMessage(slug, isActive))) return;
    try {
      await InstalledThemesPageController.delete(slug);
      notify(NotificationType.SUCCESS, 'Theme Deleted', `${slug} has been removed.`);
      await this.host.refresh();
    } catch (error: any) {
      notify(NotificationType.ERROR, 'Deletion Failed', error.message);
    }
  }

  async update(slug: string): Promise<void> {
    const { notify } = this.host.notify;
    try {
      notify(NotificationType.INFO, 'Updating...', `Downloading latest version of ${slug}...`);
      await InstalledThemesPageController.update(slug);
      notify(NotificationType.SUCCESS, 'Updated', `Theme ${slug} has been updated.`);
      await this.host.refresh();
      this.host.triggerRefresh();
    } catch (error: any) {
      notify(NotificationType.ERROR, 'Update Failed', error.message);
    }
  }
}
