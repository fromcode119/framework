"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import MediaPageView from './components/media-page-view';
import { MediaPageActions } from './media-page-actions';
import type {
  MediaFolder,
  MediaItem,
  MediaPageClientState,
  MediaPageHost,
  MediaPageModel,
  MovingItem,
} from './media-page.interfaces';

export default class MediaPageClient
  extends AdminComponent<Record<string, never>, MediaPageClientState>
  implements MediaPageHost {
  private static readonly FETCH_DEBOUNCE_MS = 300;

  mounted = false;

  private fetchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly fileInputRef = React.createRef<HTMLInputElement>();
  private readonly actions = new MediaPageActions(this);

  state: MediaPageClientState = {
    items: [],
    folders: [],
    currentFolderId: null,
    folderPath: [],
    loading: true,
    uploading: false,
    searchQuery: '',
    viewMode: 'grid',
    error: null,
    isDragOver: false,
    isFolderPromptOpen: false,
    isRenamePromptOpen: false,
    isDeleteDialogOpen: false,
    isFolderDeleteDialogOpen: false,
    isMoveDialogOpen: false,
    deletingId: null,
    editingFolder: null,
    editingItem: null,
    movingItem: null,
    isActionLoading: false,
    optimizingId: null,
  };

  patch(patch: Partial<MediaPageClientState>): void {
    this.setState(patch as Pick<MediaPageClientState, keyof MediaPageClientState>);
  }

  patchWith(updater: (state: MediaPageClientState) => Partial<MediaPageClientState>): void {
    this.setState((value) => updater(value) as Pick<MediaPageClientState, keyof MediaPageClientState>);
  }

  refresh(): Promise<void> {
    return this.actions.fetchMedia();
  }

  componentDidMount(): void {
    this.mounted = true;
    this.scheduleFetch();
  }

  componentDidUpdate(_prevProps: Record<string, never>, prevState: MediaPageClientState): void {
    if (prevState.currentFolderId !== this.state.currentFolderId || prevState.searchQuery !== this.state.searchQuery) {
      this.scheduleFetch();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.clearFetchTimer();
  }

  private clearFetchTimer(): void {
    if (this.fetchTimer) clearTimeout(this.fetchTimer);
    this.fetchTimer = null;
  }

  /** Mirrors the original debounced effect on [currentFolderId, searchQuery]. */
  private scheduleFetch(): void {
    this.clearFetchTimer();
    this.fetchTimer = setTimeout(() => void this.actions.fetchMedia(), MediaPageClient.FETCH_DEBOUNCE_MS);
  }

  private buildModel(): MediaPageModel {
    const {
      items,
      folders,
      currentFolderId,
      folderPath,
      loading,
      uploading,
      searchQuery,
      viewMode,
      error,
      isDragOver,
      isFolderPromptOpen,
      isRenamePromptOpen,
      isDeleteDialogOpen,
      isFolderDeleteDialogOpen,
      isMoveDialogOpen,
      editingFolder,
      editingItem,
      isActionLoading,
      optimizingId,
    } = this.state;

    return {
      theme: this.theme,
      items,
      folders,
      currentFolderId,
      setCurrentFolderId: (id) => this.setState({ currentFolderId: id }),
      folderPath,
      loading,
      uploading,
      searchQuery,
      setSearchQuery: (value) => this.setState({ searchQuery: value }),
      viewMode,
      setViewMode: (mode) => this.setState({ viewMode: mode }),
      error,
      setError: (value) => this.setState({ error: value }),
      isDragOver,
      isFolderPromptOpen,
      setIsFolderPromptOpen: (value) => this.setState({ isFolderPromptOpen: value }),
      isRenamePromptOpen,
      setIsRenamePromptOpen: (value) => this.setState({ isRenamePromptOpen: value }),
      isDeleteDialogOpen,
      setIsDeleteDialogOpen: (value) => this.setState({ isDeleteDialogOpen: value }),
      isFolderDeleteDialogOpen,
      setIsFolderDeleteDialogOpen: (value) => this.setState({ isFolderDeleteDialogOpen: value }),
      isMoveDialogOpen,
      setIsMoveDialogOpen: (value) => this.setState({ isMoveDialogOpen: value }),
      setDeletingId: (id) => this.setState({ deletingId: id }),
      editingFolder,
      setEditingFolder: (folder: MediaFolder | null) => this.setState({ editingFolder: folder }),
      editingItem,
      setEditingItem: (item: MediaItem | null) => this.setState({ editingItem: item }),
      setMovingItem: (item: MovingItem | null) => this.setState({ movingItem: item }),
      isActionLoading,
      optimizingId,
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
      handleUpdateDetails: (alt, caption) => this.actions.updateDetails(alt, caption),
    };
  }

  /** Owns the file-input element, so it clears the picker after a successful upload. */
  private async handleUpload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = e.target.files;
    if (!files?.length) return;
    await this.actions.upload(files);
    if (this.fileInputRef.current) this.fileInputRef.current.value = '';
  }

  render(): React.ReactNode {
    return <MediaPageView {...this.buildModel()} />;
  }
}
