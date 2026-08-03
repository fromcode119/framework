import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, bound, prop } from '@fromcode119/reactor';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { PromptDialog } from '@/components/ui/view/prompt-dialog.client';
import { MoveDialog } from '@/components/ui/view/move-dialog.client';
import { FrameworkIcons } from '@fromcode119/react';
import { MediaDetailsDialog } from '@/app/media/components/view/media-details-dialog.client';
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';
export class MediaDialogs extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare editingFolder: IMediaFolder | null;
  @prop declare editingItem: IMediaItem | null;
  @prop declare setEditingItem: (item: IMediaItem | null) => void;
  @prop declare handleUpdateDetails: (alt: string, caption: string) => Promise<void>;
  @prop declare isActionLoading: boolean;
  @prop declare isMoveDialogOpen: boolean;
  @prop declare isFolderPromptOpen: boolean;
  @prop declare isRenamePromptOpen: boolean;
  @prop declare isDeleteDialogOpen: boolean;
  @prop declare isFolderDeleteDialogOpen: boolean;
  @prop declare setIsMoveDialogOpen: (value: boolean) => void;
  @prop declare setIsFolderPromptOpen: (value: boolean) => void;
  @prop declare setIsRenamePromptOpen: (value: boolean) => void;
  @prop declare setIsDeleteDialogOpen: (value: boolean) => void;
  @prop declare setIsFolderDeleteDialogOpen: (value: boolean) => void;
  @prop declare setEditingFolder: (folder: IMediaFolder | null) => void;
  @prop declare setDeletingId: (id: number | null) => void;
  @prop declare setMovingItem: (item: IMovingItem | null) => void;
  @prop declare handleMove: (targetFolderId: number | null) => Promise<void>;
  @prop declare handleCreateFolder: (name: string) => Promise<void>;
  @prop declare handleRenameFolder: (name: string) => Promise<void>;
  @prop declare handleDelete: () => Promise<void>;
  @prop declare handleDeleteFolder: () => Promise<void>;

  @bound closeDetails(): void {
    this.setEditingItem(null);
  }

  @bound closeMoveDialog(): void {
    this.setIsMoveDialogOpen(false);
    this.setMovingItem(null);
  }

  @bound closeFolderPrompt(): void {
    this.setIsFolderPromptOpen(false);
  }

  @bound closeRenamePrompt(): void {
    this.setIsRenamePromptOpen(false);
    this.setEditingFolder(null);
  }

  @bound closeDeleteDialog(): void {
    this.setIsDeleteDialogOpen(false);
    this.setDeletingId(null);
  }

  @bound closeFolderDeleteDialog(): void {
    this.setIsFolderDeleteDialogOpen(false);
    this.setEditingFolder(null);
  }

  render(): ReactNode {
    return (
      <>
        <MediaDetailsDialog
          item={this.editingItem}
          isLoading={this.isActionLoading}
          onClose={this.closeDetails}
          onConfirm={this.handleUpdateDetails}
        />

        <MoveDialog
          isOpen={this.isMoveDialogOpen}
          onClose={this.closeMoveDialog}
          onConfirm={this.handleMove}
          isLoading={this.isActionLoading}
        />

        <PromptDialog
          isOpen={this.isFolderPromptOpen}
          onClose={this.closeFolderPrompt}
          onConfirm={this.handleCreateFolder}
          title="Create New Folder"
          description="Enter a name for the new folder to keep your assets organized."
          placeholder="Folder name"
          confirmLabel="Create Folder"
          isLoading={this.isActionLoading}
          icon={<FrameworkIcons.FolderPlus size={24} />}
        />

        <PromptDialog
          isOpen={this.isRenamePromptOpen}
          onClose={this.closeRenamePrompt}
          onConfirm={this.handleRenameFolder}
          title="Rename Folder"
          description="Enter a new name for this folder."
          placeholder="Folder name"
          defaultValue={this.editingFolder?.name}
          confirmLabel="Rename Folder"
          isLoading={this.isActionLoading}
          icon={<FrameworkIcons.Edit size={24} />}
        />

        <ConfirmDialog
          isOpen={this.isDeleteDialogOpen}
          onClose={this.closeDeleteDialog}
          onConfirm={this.handleDelete}
          title="Delete Asset"
          description="Are you sure you want to delete this asset? This action cannot be undone."
          confirmLabel="Delete Asset"
          variant={ButtonVariant.DANGER}
          isLoading={this.isActionLoading}
        />

        <ConfirmDialog
          isOpen={this.isFolderDeleteDialogOpen}
          onClose={this.closeFolderDeleteDialog}
          onConfirm={this.handleDeleteFolder}
          title="Delete Folder"
          description="Are you sure you want to delete this folder? Assets inside will be moved to the parent folder. This action cannot be undone."
          confirmLabel="Delete Folder"
          variant={ButtonVariant.DANGER}
          isLoading={this.isActionLoading}
        />
      </>
    );
  }
}
