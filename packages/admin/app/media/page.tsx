"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Slot } from '@fromcode119/react';
import { useTheme } from '@/components/theme-context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeading } from '@/components/ui/page-heading';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PromptDialog } from '@/components/ui/prompt-dialog';
import { MoveDialog } from '@/components/ui/move-dialog';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';
import { AdminServices } from '@/lib/admin-services';

const { 
  File,
  Media, 
  Upload, 
  Search, 
  Grid, 
  List, 
  FolderPlus,
  Folder,
  Download,
  Trash,
  Loader,
  External,
  Alert,
  Edit
} = FrameworkIcons;

interface MediaFolder {
  id: number;
  name: string;
  parentId: number | null;
}

interface MediaItem {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  url: string;
  folderId: number | null;
  createdAt: string;
}

export default function MediaPage() {
  const { theme } = useTheme();
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
  const [movingItem, setMovingItem] = useState<{ id: number; type: 'file' | 'folder' } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const q = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : '';
      const f = currentFolderId !== null ? `&folderId=${currentFolderId}` : (searchQuery ? '' : '&folderId=null');
      
      const [mediaData, folderData] = await Promise.all([
        api.get(`${ENDPOINTS.MEDIA.BASE}?${q}${f}`),
        api.get(`${ENDPOINTS.MEDIA.BASE}/folders?parentId=${currentFolderId || 'null'}`)
      ]);
      
      setItems(mediaData);
      setFolders(folderData);

      if (currentFolderId) {
        const pathData = await api.get(`${ENDPOINTS.MEDIA.BASE}/folders/${currentFolderId}/path`);
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
      await api.post(`${ENDPOINTS.MEDIA.BASE}/folders`, {
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
      await api.patch(`${ENDPOINTS.MEDIA.BASE}/folders/${editingFolder.id}`, {
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
      await api.delete(`${ENDPOINTS.MEDIA.BASE}/folders/${editingFolder.id}`);
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
        await api.patch(`${ENDPOINTS.MEDIA.BASE}/${movingItem.id}`, {
          folderId: targetFolderId === null ? 'null' : targetFolderId
        });
      } else {
        await api.patch(`${ENDPOINTS.MEDIA.BASE}/folders/${movingItem.id}`, {
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
        await api.upload(ENDPOINTS.MEDIA.UPLOAD, formData);
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
      await api.delete(`${ENDPOINTS.MEDIA.BASE}/${deletingId}`);
      setItems(items.filter(i => i.id !== deletingId));
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="w-full pb-24 animate-in fade-in duration-500">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple
        onChange={handleUpload}
      />
      
      {/* Premium Media Header */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)]'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <button 
                  onClick={() => setCurrentFolderId(null)}
                  className={`text-[10px] font-semibold tracking-wide transition-colors ${!currentFolderId ? 'text-indigo-500' : 'text-slate-400 hover:text-indigo-600'}`}
                >
                  Root Library
                </button>
                {folderPath.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    <span className="text-slate-300 dark:text-slate-700">/</span>
                    <button 
                      onClick={() => setCurrentFolderId(folder.id)}
                      className={`text-[10px] font-semibold tracking-wide transition-colors ${index === folderPath.length - 1 ? 'text-indigo-500' : 'text-slate-400 hover:text-indigo-600'}`}
                    >
                      {folder.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
              <Slot
                name="admin.media.header.title"
                props={{ theme, currentFolderId, folderPath }}
                fallback={
                  <PageHeading
                    icon={(
                      <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 transition-transform hover:rotate-0 ${
                        theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-600 text-white'
                      }`}>
                        <FrameworkIcons.Media size={20} strokeWidth={2.5} />
                      </div>
                    )}
                    title="Media Assets"
                    subtitle="Manage and organize your media library."
                    subtitleClassName="text-slate-500 font-bold text-xs tracking-tight opacity-80 mt-2"
                  />
                }
              />
            </div>
            
            <div className="flex items-center gap-4">
              <Slot name="admin.media.header.actions" />
              <button 
                onClick={() => setIsFolderPromptOpen(true)}
                className={`p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-100 text-slate-500 hover:text-indigo-600 shadow-sm'
                }`}
              >
                <FolderPlus size={18} strokeWidth={2.5} />
              </button>
              <Button 
                size="sm"
                className="px-6 font-bold"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                icon={uploading ? <Loader size={18} className="animate-spin" /> : <Upload size={18} strokeWidth={3} />}
              >
                {uploading ? 'Synching...' : 'Upload Asset'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-12 pt-12 space-y-8 pb-12">
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed transition-all p-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-500/10'
              : theme === 'dark'
                ? 'border-slate-700 bg-slate-900/30'
                : 'border-slate-300 bg-slate-50/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDragOver ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}>
              <Upload size={18} />
            </div>
            <div className="text-sm">
              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {isDragOver ? 'Drop files to upload' : 'Drag files here'}
              </div>
              <div className="text-xs text-slate-500">Upload images, videos, or documents to the current folder.</div>
            </div>
          </div>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Browse Files'}
          </Button>
        </div>

        {error && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
            <Alert size={18} />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto hover:opacity-70">
              <FrameworkIcons.Close size={16} />
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search media..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full rounded-xl py-2 pl-12 pr-4 text-[13px] outline-none border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`} 
            />
          </div>
          <div className={`flex items-center border rounded-xl p-0.5 transition-all duration-300 shadow-sm ${
            theme === 'dark' 
              ? 'bg-slate-900 border-slate-800' 
              : 'bg-slate-100/80 border-slate-200/60'
          }`}>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' 
                ? (theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50') 
                : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Grid size={16} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' 
                ? (theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50') 
                : 'text-slate-500 hover:text-slate-700'}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
             <Loader className="animate-spin text-indigo-500" size={48} />
             <p className="text-slate-500">Loading your assets...</p>
          </div>
        ) : (items.length === 0 && folders.length === 0) ? (
          <div className={`flex flex-col items-center justify-center py-24 rounded-2xl border-2 border-dashed ${theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
             <div className="p-4 bg-indigo-500/10 rounded-full text-indigo-500 mb-4 text-3xl">
                <Media />
             </div>
             <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No assets yet</h3>
             <p className="text-slate-500 mt-2">Upload your first image, video or document to get started.</p>
             <Button size="sm" className="mt-6" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} />
                <span>Upload Now</span>
             </Button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" : "space-y-2"}>
            {folders.map(folder => (
              <Card 
                key={`folder-${folder.id}`} 
                className={`group cursor-pointer hover:border-indigo-500/50 transition-all relative rounded-3xl ${viewMode === 'list' ? 'p-3 flex items-center gap-4' : 'p-6 flex flex-col items-center justify-center text-center'}`}
                onClick={() => setCurrentFolderId(folder.id)}
              >
                <div className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-amber-500/10 text-amber-500' : 'bg-amber-50 text-amber-600'}`}>
                  <Folder size={viewMode === 'grid' ? 32 : 20} />
                </div>
                <div className={viewMode === 'grid' ? "mt-4" : ""}>
                  <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{folder.name}</div>
                  {viewMode === 'grid' && <div className="text-[10px] text-slate-500 tracking-wide font-semibold mt-1">Folder</div>}
                </div>

                <div className={`absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${viewMode === 'list' ? 'static ml-auto opacity-100' : ''}`}>
                   <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFolder(folder);
                      setIsRenamePromptOpen(true);
                    }}
                    className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-white shadow-sm border border-slate-100 hover:bg-slate-50 text-slate-500'}`}
                  >
                    <Edit size={14} />
                  </button>
                   <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setMovingItem({ id: folder.id, type: 'folder' });
                      setIsMoveDialogOpen(true);
                    }}
                    className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-white shadow-sm border border-slate-100 hover:bg-slate-50 text-slate-500'}`}
                  >
                    <External size={14} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFolder(folder);
                      setIsFolderDeleteDialogOpen(true);
                    }}
                    className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400' : 'bg-white shadow-sm border border-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600'}`}
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </Card>
            ))}

            {items.map((item) => (
              (() => {
                const mediaUrl = AdminServices.getInstance().media.resolveMediaUrl(item.url);
                return (
              viewMode === 'grid' ? (
                <Card key={item.id} className="p-0 overflow-hidden group rounded-3xl bg-white dark:bg-slate-900/50 border-none shadow-xl shadow-slate-200/50 dark:shadow-none">
                  <div className={`aspect-square relative flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-700/5'}`}>
                    {item.mimeType.startsWith('image/') ? (
                      <img 
                        src={mediaUrl} 
                        alt={item.originalName} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <File size={48} className="text-slate-300 group-hover:scale-110 transition-transform duration-500" />
                    )}
                    
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a 
                          href={mediaUrl} 
                          download 
                          className="p-2 bg-white rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download size={18} />
                        </a>
                        <button 
                          onClick={() => {
                            setMovingItem({ id: item.id, type: 'file' });
                            setIsMoveDialogOpen(true);
                          }}
                          className="p-2 bg-white rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <External size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setDeletingId(item.id);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="p-2 bg-white rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash size={18} />
                        </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className={`font-semibold text-sm truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`} title={item.originalName}>
                      {item.originalName}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-slate-500 font-medium tracking-wide">{AdminServices.getInstance().formatter.formatSize(item.fileSize)}</span>
                      <Badge variant="gray" className="text-[10px]">
                        {item.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card key={item.id} className="p-3 flex items-center gap-4 group rounded-xl bg-white dark:bg-slate-900/50 border-none shadow-sm">
                   <div className={`h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      {item.mimeType.startsWith('image/') ? (
                        <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <File size={20} className="text-slate-400" />
                      )}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className={`font-semibold text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{item.originalName}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{AdminServices.getInstance().formatter.formatSize(item.fileSize)} • {item.mimeType}</div>
                   </div>
                   <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={mediaUrl} download className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500"><Download size={16} /></a>
                      <button 
                        onClick={() => {
                          setMovingItem({ id: item.id, type: 'file' });
                          setIsMoveDialogOpen(true);
                        }} 
                        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-indigo-500"
                      >
                        <External size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setDeletingId(item.id);
                          setIsDeleteDialogOpen(true);
                        }} 
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"
                      >
                        <Trash size={16} />
                      </button>
                   </div>
                </Card>
              )
              );
            })()
            ))}
          </div>
        )}
      </div>

      <Slot name="admin.media.bottom" />

      {/* Premium Footer */}
      <div className={`p-10 border-t mt-auto ${
        theme === 'dark' ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'
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
    </div>
  );
}
