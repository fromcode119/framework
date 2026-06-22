"use client";

import React from 'react';
import { Slot } from '@fromcode119/react';
import MediaToolbar from './media-toolbar';
import MediaControls from './media-controls';
import MediaGrid from './media-grid';
import MediaDialogs from './media-dialogs';
import type { MediaPageViewProps } from '../media-page.interfaces';

export default class MediaPageView extends React.Component<MediaPageViewProps> {
  render(): React.ReactNode {
    const m = this.props;

    return (
      <div className="w-full pb-24 animate-in fade-in duration-500">
        <input
          type="file"
          ref={m.fileInputRef}
          className="hidden"
          multiple
          onChange={m.handleUpload}
        />

        {/* Media Header */}
        <MediaToolbar
          theme={m.theme}
          uploading={m.uploading}
          isDragOver={m.isDragOver}
          error={m.error}
          searchQuery={m.searchQuery}
          viewMode={m.viewMode}
          fileInputRef={m.fileInputRef}
          currentFolderId={m.currentFolderId}
          folderPath={m.folderPath}
          setCurrentFolderId={m.setCurrentFolderId}
          setIsFolderPromptOpen={m.setIsFolderPromptOpen}
          setSearchQuery={m.setSearchQuery}
          setViewMode={m.setViewMode}
          setError={m.setError}
          handleDragEnter={m.handleDragEnter}
          handleDragOver={m.handleDragOver}
          handleDragLeave={m.handleDragLeave}
          handleDrop={m.handleDrop}
        />

        <div className="w-full px-6 lg:px-12 pt-12 space-y-8 pb-12">
          <MediaControls
            theme={m.theme}
            uploading={m.uploading}
            isDragOver={m.isDragOver}
            error={m.error}
            searchQuery={m.searchQuery}
            viewMode={m.viewMode}
            fileInputRef={m.fileInputRef}
            currentFolderId={m.currentFolderId}
            folderPath={m.folderPath}
            setCurrentFolderId={m.setCurrentFolderId}
            setIsFolderPromptOpen={m.setIsFolderPromptOpen}
            setSearchQuery={m.setSearchQuery}
            setViewMode={m.setViewMode}
            setError={m.setError}
            handleDragEnter={m.handleDragEnter}
            handleDragOver={m.handleDragOver}
            handleDragLeave={m.handleDragLeave}
            handleDrop={m.handleDrop}
          />

          <MediaGrid
            theme={m.theme}
            loading={m.loading}
            items={m.items}
            folders={m.folders}
            viewMode={m.viewMode}
            optimizingId={m.optimizingId}
            fileInputRef={m.fileInputRef}
            setCurrentFolderId={m.setCurrentFolderId}
            setEditingFolder={m.setEditingFolder}
            setIsRenamePromptOpen={m.setIsRenamePromptOpen}
            setIsFolderDeleteDialogOpen={m.setIsFolderDeleteDialogOpen}
            setMovingItem={m.setMovingItem}
            setIsMoveDialogOpen={m.setIsMoveDialogOpen}
            setDeletingId={m.setDeletingId}
            setIsDeleteDialogOpen={m.setIsDeleteDialogOpen}
            handleOptimize={m.handleOptimize}
          />
        </div>

        <Slot name="admin.media.bottom" />

        {/* Premium Footer */}
        <div className={`p-10 border-t mt-auto ${
          m.theme === 'dark' ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'
        }`}>
          <div className="w-full px-6 lg:px-12">
             <div className="flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                  <span className="text-[10px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">
                    Media Vault
                  </span>
                </div>
                <p className="text-[9px] font-medium text-slate-400">Secure storage for all your platform assets.</p>
              </div>
            </div>
          </div>
        </div>

        <MediaDialogs
          theme={m.theme}
          editingFolder={m.editingFolder}
          isActionLoading={m.isActionLoading}
          isMoveDialogOpen={m.isMoveDialogOpen}
          isFolderPromptOpen={m.isFolderPromptOpen}
          isRenamePromptOpen={m.isRenamePromptOpen}
          isDeleteDialogOpen={m.isDeleteDialogOpen}
          isFolderDeleteDialogOpen={m.isFolderDeleteDialogOpen}
          setIsMoveDialogOpen={m.setIsMoveDialogOpen}
          setIsFolderPromptOpen={m.setIsFolderPromptOpen}
          setIsRenamePromptOpen={m.setIsRenamePromptOpen}
          setIsDeleteDialogOpen={m.setIsDeleteDialogOpen}
          setIsFolderDeleteDialogOpen={m.setIsFolderDeleteDialogOpen}
          setEditingFolder={m.setEditingFolder}
          setDeletingId={m.setDeletingId}
          setMovingItem={m.setMovingItem}
          handleMove={m.handleMove}
          handleCreateFolder={m.handleCreateFolder}
          handleRenameFolder={m.handleRenameFolder}
          handleDelete={m.handleDelete}
          handleDeleteFolder={m.handleDeleteFolder}
        />
      </div>
    );
  }
}
