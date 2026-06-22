"use client";

import React from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PromptDialog } from '@/components/ui/prompt-dialog';
import { MoveDialog } from '@/components/ui/move-dialog';
import { FrameworkIcons } from '@fromcode119/react';
import type { MediaDialogsProps } from '../media-page.interfaces';

const { FolderPlus, Edit } = FrameworkIcons;

export default class MediaDialogs extends React.Component<MediaDialogsProps> {
  render(): React.ReactNode {
    const {
      editingFolder,
      isActionLoading,
      isMoveDialogOpen,
      isFolderPromptOpen,
      isRenamePromptOpen,
      isDeleteDialogOpen,
      isFolderDeleteDialogOpen,
      setIsMoveDialogOpen,
      setIsFolderPromptOpen,
      setIsRenamePromptOpen,
      setIsDeleteDialogOpen,
      setIsFolderDeleteDialogOpen,
      setEditingFolder,
      setDeletingId,
      setMovingItem,
      handleMove,
      handleCreateFolder,
      handleRenameFolder,
      handleDelete,
      handleDeleteFolder,
    } = this.props;

    return (
      <>
        <MoveDialog
          isOpen={isMoveDialogOpen}
          onClose={() => {
            setIsMoveDialogOpen(false);
            setMovingItem(null);
          }}
          onConfirm={handleMove}
          isLoading={isActionLoading}
        />

        <PromptDialog
          isOpen={isFolderPromptOpen}
          onClose={() => setIsFolderPromptOpen(false)}
          onConfirm={handleCreateFolder}
          title="Create New Folder"
          description="Enter a name for the new folder to keep your assets organized."
          placeholder="Folder name"
          confirmLabel="Create Folder"
          isLoading={isActionLoading}
          icon={<FolderPlus size={24} />}
        />

        <PromptDialog
          isOpen={isRenamePromptOpen}
          onClose={() => {
            setIsRenamePromptOpen(false);
            setEditingFolder(null);
          }}
          onConfirm={handleRenameFolder}
          title="Rename Folder"
          description="Enter a new name for this folder."
          placeholder="Folder name"
          defaultValue={editingFolder?.name}
          confirmLabel="Rename Folder"
          isLoading={isActionLoading}
          icon={<Edit size={24} />}
        />

        <ConfirmDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setDeletingId(null);
          }}
          onConfirm={handleDelete}
          title="Delete Asset"
          description="Are you sure you want to delete this asset? This action cannot be undone."
          confirmLabel="Delete Asset"
          variant="danger"
          isLoading={isActionLoading}
        />

        <ConfirmDialog
          isOpen={isFolderDeleteDialogOpen}
          onClose={() => {
            setIsFolderDeleteDialogOpen(false);
            setEditingFolder(null);
          }}
          onConfirm={handleDeleteFolder}
          title="Delete Folder"
          description="Are you sure you want to delete this folder? Assets inside will be moved to the parent folder. This action cannot be undone."
          confirmLabel="Delete Folder"
          variant="danger"
          isLoading={isActionLoading}
        />
      </>
    );
  }
}
