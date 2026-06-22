import React, { useState, useEffect, useRef } from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import type { MediaFolder, MediaItem, MediaPageModel, MovingItem } from './media-page.interfaces';

export class MediaPageController {
  static useModel(): MediaPageModel {
    const { theme } = ThemeHooks.useTheme();
    const [items, setItems] = useState<MediaItem[]>([]);
    const [folders, setFolders] = useState<MediaFolder[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [folderPath, setFolderPath] = useState<MediaFolder[]>([]);

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    // Dialog States
    const [isFolderPromptOpen, setIsFolderPromptOpen] = useState(false);
    const [isRenamePromptOpen, setIsRenamePromptOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isFolderDeleteDialogOpen, setIsFolderDeleteDialogOpen] = useState(false);
    const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [editingFolder, setEditingFolder] = useState<MediaFolder | null>(null);
    const [movingItem, setMovingItem] = useState<MovingItem | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [optimizingId, setOptimizingId] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragDepthRef = useRef(0);

    const fetchMedia = async () => {
      setLoading(true);
      try {
        const q = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : '';
        const f = currentFolderId !== null ? `&folderId=${currentFolderId}` : (searchQuery ? '' : '&folderId=null');

        const [mediaData, folderData] = await Promise.all([
          AdminApi.get(`${AdminConstants.ENDPOINTS.MEDIA.BASE}?${q}${f}`),
          AdminApi.get(`${AdminConstants.ENDPOINTS.MEDIA.BASE}/folders?parentId=${currentFolderId || 'null'}`)
        ]);

        setItems(mediaData);
        setFolders(folderData);

        if (currentFolderId) {
          const pathData = await AdminApi.get(`${AdminConstants.ENDPOINTS.MEDIA.BASE}/folders/${currentFolderId}/path`);
          setFolderPath(pathData);
        } else {
          setFolderPath([]);
        }
      } catch (err) {
        console.error('Failed to fetch media:', err);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      const timer = setTimeout(() => {
        fetchMedia();
      }, 300);
      return () => clearTimeout(timer);
    }, [currentFolderId, searchQuery]);

    const handleCreateFolder = async (name: string) => {
      setIsActionLoading(true);
      setError(null);
      try {
        await AdminApi.post(`${AdminConstants.ENDPOINTS.MEDIA.BASE}/folders`, {
          name,
          parentId: currentFolderId
        });
        setIsFolderPromptOpen(false);
        fetchMedia();
      } catch (err: any) {
        console.error('Failed to create folder:', err);
        setError(err.message || 'Failed to create folder');
      } finally {
        setIsActionLoading(false);
      }
    };

    const handleRenameFolder = async (name: string) => {
      if (!editingFolder) return;
      setIsActionLoading(true);
      setError(null);
      try {
        await AdminApi.patch(`${AdminConstants.ENDPOINTS.MEDIA.BASE}/folders/${editingFolder.id}`, {
          name
        });
        setIsRenamePromptOpen(false);
        setEditingFolder(null);
        fetchMedia();
      } catch (err: any) {
        console.error('Failed to rename folder:', err);
        setError(err.message || 'Failed to rename folder');
      } finally {
        setIsActionLoading(false);
      }
    };

    const handleDeleteFolder = async () => {
      if (!editingFolder) return;
      setIsActionLoading(true);
      try {
        await AdminApi.delete(`${AdminConstants.ENDPOINTS.MEDIA.BASE}/folders/${editingFolder.id}`);
        setIsFolderDeleteDialogOpen(false);
        setEditingFolder(null);
        fetchMedia();
      } catch (err: any) {
        console.error('Delete folder failed:', err);
        setError(err.message || 'Failed to delete folder');
      } finally {
        setIsActionLoading(false);
      }
    };

    const handleMove = async (targetFolderId: number | null) => {
      if (!movingItem) return;
      setIsActionLoading(true);
      try {
        if (movingItem.type === 'file') {
          await AdminApi.patch(`${AdminConstants.ENDPOINTS.MEDIA.BASE}/${movingItem.id}`, {
            folderId: targetFolderId === null ? 'null' : targetFolderId
          });
        } else {
          await AdminApi.patch(`${AdminConstants.ENDPOINTS.MEDIA.BASE}/folders/${movingItem.id}`, {
            parentId: targetFolderId === null ? 'null' : targetFolderId
          });
        }
        setIsMoveDialogOpen(false);
        setMovingItem(null);
        fetchMedia();
      } catch (err: any) {
        console.error('Failed to move item:', err);
        setError(err.message || 'Failed to move item');
      } finally {
        setIsActionLoading(false);
      }
    };

    const uploadFiles = async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        for (const file of list) {
          const formData = new FormData();
          formData.append('file', file);
          if (currentFolderId) formData.append('folderId', currentFolderId.toString());
          await AdminApi.upload(AdminConstants.ENDPOINTS.MEDIA.UPLOAD, formData);
        }

        fetchMedia();
      } catch (err: any) {
        console.error('Upload failed:', err);
        setError(err?.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      await uploadFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const isFileDrag = (e: React.DragEvent) => e.dataTransfer?.types?.includes('Files');

    const handleDragEnter = (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current += 1;
      setIsDragOver(true);
    };

    const handleDragOver = (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    };

    const handleDragLeave = (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragOver(false);
      }
    };

    const handleDrop = async (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (!files?.length) return;
      await uploadFiles(files);
    };

    const handleDelete = async () => {
      if (!deletingId) return;
      setIsActionLoading(true);
      try {
        await AdminApi.delete(`${AdminConstants.ENDPOINTS.MEDIA.BASE}/${deletingId}`);
        setItems(items.filter(i => i.id !== deletingId));
        setIsDeleteDialogOpen(false);
        setDeletingId(null);
      } catch (err) {
        console.error('Delete failed:', err);
      } finally {
        setIsActionLoading(false);
      }
    };

    const handleOptimize = async (item: MediaItem) => {
      setOptimizingId(item.id);
      setError(null);
      try {
        const result = await AdminApi.post(`${AdminConstants.ENDPOINTS.MEDIA.BASE}/${item.id}/optimize`, {});
        setItems(prev => prev.map(i => i.id === item.id ? {
          ...i,
          optimizedUrl: result.optimizedUrl,
          optimizedSize: result.optimizedSize,
          optimizedWidth: result.optimizedWidth,
          optimizedHeight: result.optimizedHeight,
        } : i));
      } catch (err: any) {
        console.error('Optimize failed:', err);
        setError(err?.message || 'Failed to optimize image');
      } finally {
        setOptimizingId(null);
      }
    };

    return {
      theme,
      items,
      folders,
      currentFolderId,
      setCurrentFolderId,
      folderPath,
      loading,
      uploading,
      searchQuery,
      setSearchQuery,
      viewMode,
      setViewMode,
      error,
      setError,
      isDragOver,
      isFolderPromptOpen,
      setIsFolderPromptOpen,
      isRenamePromptOpen,
      setIsRenamePromptOpen,
      isDeleteDialogOpen,
      setIsDeleteDialogOpen,
      isFolderDeleteDialogOpen,
      setIsFolderDeleteDialogOpen,
      isMoveDialogOpen,
      setIsMoveDialogOpen,
      setDeletingId,
      editingFolder,
      setEditingFolder,
      setMovingItem,
      isActionLoading,
      optimizingId,
      fileInputRef,
      handleCreateFolder,
      handleRenameFolder,
      handleDeleteFolder,
      handleMove,
      handleUpload,
      handleDragEnter,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleDelete,
      handleOptimize,
    };
  }
}
