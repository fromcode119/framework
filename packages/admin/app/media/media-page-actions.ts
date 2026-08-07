import type React from 'react';
import { MediaPageController } from '@/app/media/media-page-controller';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import type { IMediaPageClientState } from '@/app/media/interfaces/media-page-client-state.interface';
import type { IMediaPageHost } from '@/app/media/interfaces/media-page-host.interface';
/**
 * Orchestration for the media library: binds {@link MediaPageController} I/O to the page-client's
 * state. Hook-free — it only ever touches React through the host.
 */
export class MediaPageActions {
  /** Nested dragenter/dragleave pairs — only the outermost leave clears the overlay. */
  private dragDepth = 0;

  constructor(private readonly host: IMediaPageHost) {}

  async fetchMedia(): Promise<void> {
    const { searchQuery, currentFolderId } = this.host;
    this.host.patch({ loading: true });
    try {
      const { items, folders } = await MediaPageController.fetchLibrary(currentFolderId, searchQuery);
      if (!this.host.mounted) return;
      this.host.patch({ items, folders });

      const folderPath = await MediaPageController.fetchFolderPath(currentFolderId);
      if (!this.host.mounted) return;
      this.host.patch({ folderPath });
    } catch (err) {
      console.error('Failed to fetch media:', err);
    } finally {
      if (this.host.mounted) this.host.patch({ loading: false });
    }
  }

  async createFolder(name: string): Promise<void> {
    this.host.patch({ isActionLoading: true, error: null });
    try {
      await MediaPageController.createFolder(name, this.host.currentFolderId);
      this.host.patch({ isFolderPromptOpen: false });
      void this.host.refresh();
    } catch (err: any) {
      console.error('Failed to create folder:', err);
      this.host.patch({ error: err.message || 'Failed to create folder' });
    } finally {
      if (this.host.mounted) this.host.patch({ isActionLoading: false });
    }
  }

  async renameFolder(name: string): Promise<void> {
    const { editingFolder } = this.host;
    if (!editingFolder) return;
    this.host.patch({ isActionLoading: true, error: null });
    try {
      await MediaPageController.renameFolder(editingFolder.id, name);
      this.host.patch({ isRenamePromptOpen: false, editingFolder: null });
      void this.host.refresh();
    } catch (err: any) {
      console.error('Failed to rename folder:', err);
      this.host.patch({ error: err.message || 'Failed to rename folder' });
    } finally {
      if (this.host.mounted) this.host.patch({ isActionLoading: false });
    }
  }

  async deleteFolder(): Promise<void> {
    const { editingFolder } = this.host;
    if (!editingFolder) return;
    this.host.patch({ isActionLoading: true });
    try {
      await MediaPageController.deleteFolder(editingFolder.id);
      this.host.patch({ isFolderDeleteDialogOpen: false, editingFolder: null });
      void this.host.refresh();
    } catch (err: any) {
      console.error('Delete folder failed:', err);
      this.host.patch({ error: err.message || 'Failed to delete folder' });
    } finally {
      if (this.host.mounted) this.host.patch({ isActionLoading: false });
    }
  }

  async move(targetFolderId: number | null): Promise<void> {
    const { movingItem } = this.host;
    if (!movingItem) return;
    this.host.patch({ isActionLoading: true });
    try {
      await MediaPageController.move(movingItem, targetFolderId);
      this.host.patch({ isMoveDialogOpen: false, movingItem: null });
      void this.host.refresh();
    } catch (err: any) {
      console.error('Failed to move item:', err);
      this.host.patch({ error: err.message || 'Failed to move item' });
    } finally {
      if (this.host.mounted) this.host.patch({ isActionLoading: false });
    }
  }

  private async uploadFiles(files: FileList | File[]): Promise<void> {
    const list = Array.from(files);
    if (list.length === 0) return;
    this.host.patch({ uploading: true, error: null });
    try {
      await MediaPageController.uploadFiles(list, this.host.currentFolderId);
      void this.host.refresh();
    } catch (err: any) {
      console.error('Upload failed:', err);
      this.host.patch({ error: err?.message || 'Upload failed' });
    } finally {
      if (this.host.mounted) this.host.patch({ uploading: false });
    }
  }

  async upload(files: FileList | null | undefined): Promise<void> {
    if (!files?.length) return;
    await this.uploadFiles(files);
  }

  handleDragEnter(e: React.DragEvent): void {
    if (!MediaPageController.isFileDrag(e.dataTransfer?.types)) return;
    e.preventDefault();
    e.stopPropagation();
    this.dragDepth += 1;
    this.host.patch({ isDragOver: true });
  }

  handleDragOver(e: React.DragEvent): void {
    if (!MediaPageController.isFileDrag(e.dataTransfer?.types)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }

  handleDragLeave(e: React.DragEvent): void {
    if (!MediaPageController.isFileDrag(e.dataTransfer?.types)) return;
    e.preventDefault();
    e.stopPropagation();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.host.patch({ isDragOver: false });
  }

  async handleDrop(e: React.DragEvent): Promise<void> {
    if (!MediaPageController.isFileDrag(e.dataTransfer?.types)) return;
    e.preventDefault();
    e.stopPropagation();
    this.dragDepth = 0;
    this.host.patch({ isDragOver: false });
    await this.upload(e.dataTransfer.files);
  }

  async deleteItem(): Promise<void> {
    const { deletingId } = this.host;
    if (!deletingId) return;
    this.host.patch({ isActionLoading: true });
    try {
      await MediaPageController.deleteItem(deletingId);
      this.host.patchWith((value: IMediaPageClientState) => ({
        items: value.items.filter((i) => i.id !== deletingId),
        isDeleteDialogOpen: false,
        deletingId: null,
      }));
    } catch (err: any) {
      // Every sibling action in this file surfaces `error`; only delete swallowed it, so a failed
      // delete left the confirm dialog sitting open with no message and the item still listed.
      console.error('Delete failed:', err);
      this.host.patch({ error: err?.message || 'Failed to delete media item' });
    } finally {
      if (this.host.mounted) this.host.patch({ isActionLoading: false });
    }
  }

  async updateDetails(alt: string, caption: string): Promise<void> {
    const { editingItem } = this.host;
    if (!editingItem) return;
    this.host.patch({ isActionLoading: true, error: null });
    try {
      await MediaPageController.updateDetails(editingItem.id, alt, caption);
      this.host.patchWith((value: IMediaPageClientState) => ({
        items: value.items.map((i) => i.id === editingItem.id
          ? { ...i, alt: alt || null, caption: caption || null }
          : i),
        editingItem: null,
      }));
    } catch (err: any) {
      console.error('Failed to update media details:', err);
      this.host.patch({ error: err?.message || 'Failed to update media details' });
    } finally {
      if (this.host.mounted) this.host.patch({ isActionLoading: false });
    }
  }

  async optimize(item: IMediaItem): Promise<void> {
    this.host.patch({ optimizingId: item.id, error: null });
    try {
      const optimized = await MediaPageController.optimize(item.id);
      this.host.patchWith((value: IMediaPageClientState) => ({
        items: value.items.map((i) => i.id === item.id ? { ...i, ...optimized } : i),
      }));
    } catch (err: any) {
      console.error('Optimize failed:', err);
      this.host.patch({ error: err?.message || 'Failed to optimize image' });
    } finally {
      if (this.host.mounted) this.host.patch({ optimizingId: null });
    }
  }
}
