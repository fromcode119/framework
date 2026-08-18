import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type { ReactNode } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';
import { MediaToolbar } from '@/app/media/components/view/media-toolbar.client';
import { MediaControls } from '@/app/media/components/view/media-controls.client';
import { MediaGrid } from '@/app/media/components/view/media-grid.client';
import { MediaSharesPanel } from '@/app/media/components/view/media-shares-panel.client';
import { MediaActivityPanel } from '@/app/media/components/view/media-activity-panel.client';
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
  @prop declare themeAssets: IMediaItem[];
  @prop declare source: string;
  @prop declare setSource: (value: string) => void;
  @prop declare activeView: string;
  @prop declare setActiveView: (value: string) => void;
  @prop declare hasMore: boolean;
  @prop declare loadingMore: boolean;
  @prop declare loadMore: () => void;
  @prop declare selectedIds: number[];
  @prop declare isShareDialogOpen: boolean;
  @prop declare setEditingItem: (item: IMediaItem | null) => void;
  @prop declare toggleSelected: (id: number) => void;
  @prop declare clearSelection: () => void;
  @prop declare setIsShareDialogOpen: (value: boolean) => void;
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

  /**
   * Uploads and theme assets as one list, honouring the source filter.
   *
   * Merged rather than tabbed because "find that picture" is one job — which directory the file lives
   * in is our concern, not the operator's. The filter is there for when it IS their concern.
   */
  private get visibleItems(): any[] {
    if (this.source === 'theme') return this.themeAssets || [];
    if (this.source === 'uploads') return this.items || [];
    return [...(this.items || []), ...(this.themeAssets || [])];
  }

  @bound openShareDialog(): void {
    this.setIsShareDialogOpen(true);
  }

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
          selectedCount={(this.selectedIds || []).length}
          onShareSelected={this.openShareDialog}
          onClearSelection={this.clearSelection}
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
            source={this.source}
            setSource={this.setSource}
            activeView={this.activeView}
            setActiveView={this.setActiveView}
            handleDragEnter={this.handleDragEnter}
            handleDragOver={this.handleDragOver}
            handleDragLeave={this.handleDragLeave}
            handleDrop={this.handleDrop}
          />

          {this.activeView === 'activity' ? <MediaActivityPanel /> : this.activeView === 'shares' ? <MediaSharesPanel /> : (
          <MediaGrid
            theme={this.theme}
            loading={this.loading}
            items={this.visibleItems}
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
            selectedIds={this.selectedIds}
            toggleSelected={this.toggleSelected}
            handleOptimize={this.handleOptimize}
          />
          )}
        </div>

        <Slot name="admin.media.bottom" />

        {/* Was a 40px-tall block reading "Media Vault — Secure storage for all your platform assets."
            That is a brand line and a marketing sentence: it told the operator nothing about their
            library and cost more vertical space than the row of files above it. A footer here earns
            its place only by stating what is actually on screen. */}
        <div className={`px-6 py-3 border-t mt-auto text-[11px] ${
          this.theme === ThemeMode.DARK ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'
        }`}>
          {(this.items || []).length} file{(this.items || []).length === 1 ? '' : 's'}
          {(this.themeAssets || []).length ? ` · ${this.themeAssets.length} theme asset${this.themeAssets.length === 1 ? '' : 's'}` : ''}
          {(this.folders || []).length ? ` · ${this.folders.length} folder${this.folders.length === 1 ? '' : 's'}` : ''}
        </div>

        <MediaDialogs
          theme={this.theme}
          editingFolder={this.editingFolder}
          editingItem={this.editingItem}
          selectedIds={this.selectedIds}
          items={this.items}
          isShareDialogOpen={this.isShareDialogOpen}
          setIsShareDialogOpen={this.setIsShareDialogOpen}
          clearSelection={this.clearSelection}
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
