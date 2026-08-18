import { ViewMode } from '@/app/media/enums/view-mode.enum';
import React from 'react';

import type { ChangeEvent, ReactNode } from 'react';
import { prop, state, watch } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminPathUtils } from '@/lib/admin-path';
import { MediaPageView } from '@/app/media/components/view/media-page-view.client';
import { MediaPageActions } from '@/app/media/media-page-actions';
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import type { IMediaPageClientState } from '@/app/media/interfaces/media-page-client-state.interface';
import type { IMediaPageHost } from '@/app/media/interfaces/media-page-host.interface';
import type { IMediaPageModel } from '@/app/media/interfaces/media-page-model.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';

export class MediaPageClient extends AdminComponent implements IMediaPageHost {
  private static readonly FETCH_DEBOUNCE_MS = 300;

  mounted = false;

  private fetchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly fileInputRef = React.createRef<HTMLInputElement>();
  private readonly actions = new MediaPageActions(this);

  @state items: IMediaItem[] = [];
  @state folders: IMediaFolder[] = [];
  @state currentFolderId: number | null = null;
  @state folderPath: IMediaFolder[] = [];
  @state loading = true;
  @state uploading = false;
  @state searchQuery = '';
  @state viewMode: ViewMode = ViewMode.GRID;
  @state error: string | null = null;
  @state isDragOver = false;
  @state isFolderPromptOpen = false;
  @state isRenamePromptOpen = false;
  @state isDeleteDialogOpen = false;
  @state isFolderDeleteDialogOpen = false;
  @state isMoveDialogOpen = false;
  @state deletingId: number | null = null;
  @state editingFolder: IMediaFolder | null = null;
  @state editingItem: IMediaItem | null = null;
  /** Files that ship inside the active theme. Listed beside uploads, never writable. */
  @state themeAssets: IMediaItem[] = [];
  /** '' = everything, 'uploads' = uploaded only, 'theme' = theme bundle only. */
  @state source = '';
  /** Which view this page mounted as — set by the /media/files|shared|activity route that rendered it. */
  @prop declare initialView?: string;

  /** 'files', 'shares' or 'activity'. Different things, so a top-level switch rather than a filter. */
  @state activeView = 'files';
  @state hasMore = false;
  @state loadingMore = false;
  /** Files ticked for a bulk action. A share groups whatever is selected into one send. */
  @state selectedIds: number[] = [];
  /** True while the Share dialog is open, for whatever is currently selected. */
  @state isShareDialogOpen = false;
  @state movingItem: IMovingItem | null = null;
  @state isActionLoading = false;
  @state optimizingId: number | null = null;

  patch(patch: Partial<IMediaPageClientState>): void {
    this.setState(patch as never);
  }

  patchWith(updater: (state: IMediaPageClientState) => Partial<IMediaPageClientState>): void {
    this.setState((value) => updater(value as unknown as IMediaPageClientState) as never);
  }

  refresh(): Promise<void> {
    return this.actions.fetchMedia();
  }

  componentDidMount(): void {
    if (this.initialView) this.activeView = this.initialView;
    this.mounted = true;
    this.scheduleFetch();
  }

  /** Mirrors the original debounced effect on [currentFolderId, searchQuery]. */
  @watch('currentFolderId', 'searchQuery') onViewChanged(): void {
    this.scheduleFetch();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.clearFetchTimer();
  }

  private clearFetchTimer(): void {
    if (this.fetchTimer) clearTimeout(this.fetchTimer);
    this.fetchTimer = null;
  }

  private scheduleFetch(): void {
    this.clearFetchTimer();
    this.fetchTimer = setTimeout(() => void this.actions.fetchMedia(), MediaPageClient.FETCH_DEBOUNCE_MS);
  }

  private buildModel(): IMediaPageModel {
    return {
      theme: this.theme,
      items: this.items,
      folders: this.folders,
      currentFolderId: this.currentFolderId,
      setCurrentFolderId: (id) => { this.currentFolderId = id; },
      folderPath: this.folderPath,
      loading: this.loading,
      uploading: this.uploading,
      searchQuery: this.searchQuery,
      setSearchQuery: (value) => { this.searchQuery = value; },
      viewMode: this.viewMode,
      setViewMode: (mode) => { this.viewMode = mode; },
      error: this.error,
      setError: (value) => { this.error = value; },
      isDragOver: this.isDragOver,
      isFolderPromptOpen: this.isFolderPromptOpen,
      setIsFolderPromptOpen: (value) => { this.isFolderPromptOpen = value; },
      isRenamePromptOpen: this.isRenamePromptOpen,
      setIsRenamePromptOpen: (value) => { this.isRenamePromptOpen = value; },
      isDeleteDialogOpen: this.isDeleteDialogOpen,
      setIsDeleteDialogOpen: (value) => { this.isDeleteDialogOpen = value; },
      isFolderDeleteDialogOpen: this.isFolderDeleteDialogOpen,
      setIsFolderDeleteDialogOpen: (value) => { this.isFolderDeleteDialogOpen = value; },
      isMoveDialogOpen: this.isMoveDialogOpen,
      setIsMoveDialogOpen: (value) => { this.isMoveDialogOpen = value; },
      setDeletingId: (id) => { this.deletingId = id; },
      editingFolder: this.editingFolder,
      setEditingFolder: (folder: IMediaFolder | null) => { this.editingFolder = folder; },
      editingItem: this.editingItem,
      themeAssets: this.themeAssets,
      source: this.source,
      setSource: (value: string) => { this.source = value; },
      activeView: this.activeView,
      setActiveView: (value: string) => {
        this.activeView = value;
        // The URL follows the view, so reload and back keep the tab. `shares` is the internal name the
        // Shared view has always had; the URL says what the tab says.
        const segment = value === 'shares' ? 'shared' : value;
        window.history.pushState(null, '', AdminPathUtils.toAdminPath(`/media/${segment}`));
      },
      hasMore: this.hasMore,
      loadingMore: this.loadingMore,
      loadMore: () => this.actions.loadMore(),
      selectedIds: this.selectedIds,
      isShareDialogOpen: this.isShareDialogOpen,
      setEditingItem: (item: IMediaItem | null) => { this.editingItem = item; },
      toggleSelected: (id: number) => {
        this.selectedIds = this.selectedIds.includes(id)
          ? this.selectedIds.filter((value) => value !== id)
          : [...this.selectedIds, id];
      },
      clearSelection: () => { this.selectedIds = []; },
      setIsShareDialogOpen: (value: boolean) => { this.isShareDialogOpen = value; },
      setMovingItem: (item: IMovingItem | null) => { this.movingItem = item; },
      isActionLoading: this.isActionLoading,
      optimizingId: this.optimizingId,
      fileInputRef: this.fileInputRef,
      handleCreateFolder: (name) => this.actions.createFolder(name),
      handleRenameFolder: (name) => this.actions.renameFolder(name),
      handleDeleteFolder: () => this.actions.deleteFolder(),
      handleMove: (targetFolderId) => this.actions.move(targetFolderId),
      handleUpload: (e) => this.handleUpload(e),
      handleDragEnter: (e) => this.actions.handleDragEnter(e),
      handleDragOver: (e) => this.actions.handleDragOver(e),
      handleDragLeave: (e) => this.actions.handleDragLeave(e),
      handleDrop: (e) => this.actions.handleDrop(e),
      handleDelete: () => this.actions.deleteItem(),
      handleOptimize: (item) => this.actions.optimize(item),
      handleUpdateDetails: (alt, caption, visibility) => this.actions.updateDetails(alt, caption, visibility),
    };
  }

  /** Owns the file-input element, so it clears the picker after a successful upload. */
  private async handleUpload(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = e.target.files;
    if (!files?.length) return;
    await this.actions.upload(files);
    if (this.fileInputRef.current) this.fileInputRef.current.value = '';
  }

  render(): ReactNode {
    return <MediaPageView {...this.buildModel()} />;
  }
}
