import type { ChangeEvent, DragEvent, RefObject } from 'react';

export interface MediaFolder {
  id: number;
  name: string;
  parentId: number | null;
}

export interface MediaItem {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  url: string;
  optimizedUrl?: string | null;
  optimizedSize?: number | null;
  optimizedWidth?: number | null;
  optimizedHeight?: number | null;
  folderId: number | null;
  createdAt: string;
}

export interface MovingItem {
  id: number;
  type: 'file' | 'folder';
}

export interface MediaPageModel {
  theme: string;
  items: MediaItem[];
  folders: MediaFolder[];
  currentFolderId: number | null;
  setCurrentFolderId: (id: number | null) => void;
  folderPath: MediaFolder[];
  loading: boolean;
  uploading: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  error: string | null;
  setError: (value: string | null) => void;
  isDragOver: boolean;
  isFolderPromptOpen: boolean;
  setIsFolderPromptOpen: (value: boolean) => void;
  isRenamePromptOpen: boolean;
  setIsRenamePromptOpen: (value: boolean) => void;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (value: boolean) => void;
  isFolderDeleteDialogOpen: boolean;
  setIsFolderDeleteDialogOpen: (value: boolean) => void;
  isMoveDialogOpen: boolean;
  setIsMoveDialogOpen: (value: boolean) => void;
  setDeletingId: (id: number | null) => void;
  editingFolder: MediaFolder | null;
  setEditingFolder: (folder: MediaFolder | null) => void;
  setMovingItem: (item: MovingItem | null) => void;
  isActionLoading: boolean;
  optimizingId: number | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleCreateFolder: (name: string) => Promise<void>;
  handleRenameFolder: (name: string) => Promise<void>;
  handleDeleteFolder: () => Promise<void>;
  handleMove: (targetFolderId: number | null) => Promise<void>;
  handleUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDragEnter: (e: DragEvent) => void;
  handleDragOver: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDrop: (e: DragEvent) => Promise<void>;
  handleDelete: () => Promise<void>;
  handleOptimize: (item: MediaItem) => Promise<void>;
}

export interface MediaToolbarProps {
  theme: string;
  uploading: boolean;
  isDragOver: boolean;
  error: string | null;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  fileInputRef: RefObject<HTMLInputElement | null>;
  currentFolderId: number | null;
  folderPath: MediaFolder[];
  setCurrentFolderId: (id: number | null) => void;
  setIsFolderPromptOpen: (value: boolean) => void;
  setSearchQuery: (value: string) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setError: (value: string | null) => void;
  handleDragEnter: (e: DragEvent) => void;
  handleDragOver: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDrop: (e: DragEvent) => Promise<void>;
}

export interface MediaGridProps {
  theme: string;
  loading: boolean;
  items: MediaItem[];
  folders: MediaFolder[];
  viewMode: 'grid' | 'list';
  optimizingId: number | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  setCurrentFolderId: (id: number | null) => void;
  setEditingFolder: (folder: MediaFolder | null) => void;
  setIsRenamePromptOpen: (value: boolean) => void;
  setIsFolderDeleteDialogOpen: (value: boolean) => void;
  setMovingItem: (item: MovingItem | null) => void;
  setIsMoveDialogOpen: (value: boolean) => void;
  setDeletingId: (id: number | null) => void;
  setIsDeleteDialogOpen: (value: boolean) => void;
  handleOptimize: (item: MediaItem) => Promise<void>;
}

export interface MediaFolderCardProps {
  theme: string;
  folder: MediaFolder;
  viewMode: 'grid' | 'list';
  setCurrentFolderId: (id: number | null) => void;
  setEditingFolder: (folder: MediaFolder | null) => void;
  setIsRenamePromptOpen: (value: boolean) => void;
  setIsFolderDeleteDialogOpen: (value: boolean) => void;
  setMovingItem: (item: MovingItem | null) => void;
  setIsMoveDialogOpen: (value: boolean) => void;
}

export interface MediaItemCardProps {
  theme: string;
  item: MediaItem;
  viewMode: 'grid' | 'list';
  optimizingId: number | null;
  setMovingItem: (item: MovingItem | null) => void;
  setIsMoveDialogOpen: (value: boolean) => void;
  setDeletingId: (id: number | null) => void;
  setIsDeleteDialogOpen: (value: boolean) => void;
  handleOptimize: (item: MediaItem) => Promise<void>;
}

export interface MediaDialogsProps {
  theme: string;
  editingFolder: MediaFolder | null;
  isActionLoading: boolean;
  isMoveDialogOpen: boolean;
  isFolderPromptOpen: boolean;
  isRenamePromptOpen: boolean;
  isDeleteDialogOpen: boolean;
  isFolderDeleteDialogOpen: boolean;
  setIsMoveDialogOpen: (value: boolean) => void;
  setIsFolderPromptOpen: (value: boolean) => void;
  setIsRenamePromptOpen: (value: boolean) => void;
  setIsDeleteDialogOpen: (value: boolean) => void;
  setIsFolderDeleteDialogOpen: (value: boolean) => void;
  setEditingFolder: (folder: MediaFolder | null) => void;
  setDeletingId: (id: number | null) => void;
  setMovingItem: (item: MovingItem | null) => void;
  handleMove: (targetFolderId: number | null) => Promise<void>;
  handleCreateFolder: (name: string) => Promise<void>;
  handleRenameFolder: (name: string) => Promise<void>;
  handleDelete: () => Promise<void>;
  handleDeleteFolder: () => Promise<void>;
}

export interface MediaPageViewProps extends MediaPageModel {}
