import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type { ReactNode } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { PureReactor, prop, Ref } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';
import { MediaToolbar } from '@/app/media/components/view/media-toolbar.client';
import { MediaControls } from '@/app/media/components/view/media-controls.client';
import { MediaGrid } from '@/app/media/components/view/media-grid.client';
import { MediaDialogs } from '@/app/media/components/view/media-dialogs.client';
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';

export class MediaPageView extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare items: IMediaItem[];
  @prop declare folders: IMediaFolder[];
  @prop declare currentFolderId: number | null;
  @prop declare setCurrentFolderId: (id: number | null) => void;
  @prop declare folderPath: IMediaFolder[];
  @prop declare loading: boolean;
  @prop declare uploading: boolean;
  @prop declare searchQuery: string;
  @prop declare setSearchQuery: (value: string) => void;
  @prop declare viewMode: ViewMode;
  @prop declare setViewMode: (mode: ViewMode) => void;
  @prop declare error: string | null;
  @prop declare setError: (value: string | null) => void;
  @prop declare isDragOver: boolean;
  @prop declare isFolderPromptOpen: boolean;
  @prop declare setIsFolderPromptOpen: (value: boolean) => void;
  @prop declare isRenamePromptOpen: boolean;
  @prop declare setIsRenamePromptOpen: (value: boolean) => void;
  @prop declare isDeleteDialogOpen: boolean;
  @prop declare setIsDeleteDialogOpen: (value: boolean) => void;
  @prop declare isFolderDeleteDialogOpen: boolean;
  @prop declare setIsFolderDeleteDialogOpen: (value: boolean) => void;
  @prop declare isMoveDialogOpen: boolean;
  @prop declare setIsMoveDialogOpen: (value: boolean) => void;
  @prop declare setDeletingId: (id: number | null) => void;
  @prop declare editingFolder: IMediaFolder | null;
  @prop declare setEditingFolder: (folder: IMediaFolder | null) => void;
  @prop declare editingItem: IMediaItem | null;
  @prop declare setEditingItem: (item: IMediaItem | null) => void;
  @prop declare setMovingItem: (item: IMovingItem | null) => void;
  @prop declare isActionLoading: boolean;
  @prop declare optimizingId: number | null;
  @prop declare fileInputRef: Ref<HTMLInputElement>;
  @prop declare handleCreateFolder: (name: string) => Promise<void>;
  @prop declare handleRenameFolder: (name: string) => Promise<void>;
  @prop declare handleDeleteFolder: () => Promise<void>;
  @prop declare handleMove: (targetFolderId: number | null) => Promise<void>;
  @prop declare handleUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  @prop declare handleDragEnter: (e: DragEvent) => void;
  @prop declare handleDragOver: (e: DragEvent) => void;
  @prop declare handleDragLeave: (e: DragEvent) => void;
  @prop declare handleDrop: (e: DragEvent) => Promise<void>;
  @prop declare handleDelete: () => Promise<void>;
  @prop declare handleOptimize: (item: IMediaItem) => Promise<void>;
  @prop declare handleUpdateDetails: (alt: string, caption: string) => Promise<void>;

  render(): ReactNode {
    return (
      <div className="w-full pb-24 animate-in fade-in duration-500">
        <input
          type="file"
          ref={this.fileInputRef}
          className="hidden"
          multiple
          onChange={this.handleUpload}
        />

        {/* Media Header */}
        <MediaToolbar
          theme={this.theme}
          uploading={this.uploading}
          isDragOver={this.isDragOver}
          error={this.error}
          searchQuery={this.searchQuery}
          viewMode={this.viewMode}
          fileInputRef={this.fileInputRef}
          currentFolderId={this.currentFolderId}
          folderPath={this.folderPath}
          setCurrentFolderId={this.setCurrentFolderId}
          setIsFolderPromptOpen={this.setIsFolderPromptOpen}
          setSearchQuery={this.setSearchQuery}
          setViewMode={this.setViewMode}
          setError={this.setError}
          handleDragEnter={this.handleDragEnter}
          handleDragOver={this.handleDragOver}
          handleDragLeave={this.handleDragLeave}
          handleDrop={this.handleDrop}
        />

        <div className="w-full px-6 lg:px-12 pt-12 space-y-8 pb-12">
          <MediaControls
            theme={this.theme}
            uploading={this.uploading}
            isDragOver={this.isDragOver}
            error={this.error}
            searchQuery={this.searchQuery}
            viewMode={this.viewMode}
            fileInputRef={this.fileInputRef}
            currentFolderId={this.currentFolderId}
            folderPath={this.folderPath}
            setCurrentFolderId={this.setCurrentFolderId}
            setIsFolderPromptOpen={this.setIsFolderPromptOpen}
            setSearchQuery={this.setSearchQuery}
            setViewMode={this.setViewMode}
            setError={this.setError}
            handleDragEnter={this.handleDragEnter}
            handleDragOver={this.handleDragOver}
            handleDragLeave={this.handleDragLeave}
            handleDrop={this.handleDrop}
          />

          <MediaGrid
            theme={this.theme}
            loading={this.loading}
            items={this.items}
            folders={this.folders}
            viewMode={this.viewMode}
            optimizingId={this.optimizingId}
            fileInputRef={this.fileInputRef}
            setCurrentFolderId={this.setCurrentFolderId}
            setEditingFolder={this.setEditingFolder}
            setIsRenamePromptOpen={this.setIsRenamePromptOpen}
            setIsFolderDeleteDialogOpen={this.setIsFolderDeleteDialogOpen}
            setMovingItem={this.setMovingItem}
            setIsMoveDialogOpen={this.setIsMoveDialogOpen}
            setDeletingId={this.setDeletingId}
            setIsDeleteDialogOpen={this.setIsDeleteDialogOpen}
            setEditingItem={this.setEditingItem}
            handleOptimize={this.handleOptimize}
          />
        </div>

        <Slot name="admin.media.bottom" />

        {/* Premium Footer */}
        <div className={`p-10 border-t mt-auto ${
          this.theme === ThemeMode.DARK ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'
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
          theme={this.theme}
          editingFolder={this.editingFolder}
          editingItem={this.editingItem}
          setEditingItem={this.setEditingItem}
          handleUpdateDetails={this.handleUpdateDetails}
          isActionLoading={this.isActionLoading}
          isMoveDialogOpen={this.isMoveDialogOpen}
          isFolderPromptOpen={this.isFolderPromptOpen}
          isRenamePromptOpen={this.isRenamePromptOpen}
          isDeleteDialogOpen={this.isDeleteDialogOpen}
          isFolderDeleteDialogOpen={this.isFolderDeleteDialogOpen}
          setIsMoveDialogOpen={this.setIsMoveDialogOpen}
          setIsFolderPromptOpen={this.setIsFolderPromptOpen}
          setIsRenamePromptOpen={this.setIsRenamePromptOpen}
          setIsDeleteDialogOpen={this.setIsDeleteDialogOpen}
          setIsFolderDeleteDialogOpen={this.setIsFolderDeleteDialogOpen}
          setEditingFolder={this.setEditingFolder}
          setDeletingId={this.setDeletingId}
          setMovingItem={this.setMovingItem}
          handleMove={this.handleMove}
          handleCreateFolder={this.handleCreateFolder}
          handleRenameFolder={this.handleRenameFolder}
          handleDelete={this.handleDelete}
          handleDeleteFolder={this.handleDeleteFolder}
        />
      </div>
    );
  }
}
