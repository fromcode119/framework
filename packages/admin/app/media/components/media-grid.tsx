"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import MediaFolderCard from './media-folder-card';
import MediaItemCard from './media-item-card';
import type { MediaGridProps } from '../media-page.interfaces';

const { Media, Upload, Loader } = FrameworkIcons;

export default class MediaGrid extends React.Component<MediaGridProps> {
  render(): React.ReactNode {
    const {
      theme,
      loading,
      items,
      folders,
      viewMode,
      optimizingId,
      fileInputRef,
      setCurrentFolderId,
      setEditingFolder,
      setIsRenamePromptOpen,
      setIsFolderDeleteDialogOpen,
      setMovingItem,
      setIsMoveDialogOpen,
      setDeletingId,
      setIsDeleteDialogOpen,
      handleOptimize,
    } = this.props;

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
           <Loader className="animate-spin text-indigo-500" size={48} />
           <p className="text-slate-500">Loading your assets...</p>
        </div>
      );
    }

    if (items.length === 0 && folders.length === 0) {
      return (
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
      );
    }

    return (
      <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" : "space-y-2"}>
        {folders.map(folder => (
          <MediaFolderCard
            key={`folder-${folder.id}`}
            theme={theme}
            folder={folder}
            viewMode={viewMode}
            setCurrentFolderId={setCurrentFolderId}
            setEditingFolder={setEditingFolder}
            setIsRenamePromptOpen={setIsRenamePromptOpen}
            setIsFolderDeleteDialogOpen={setIsFolderDeleteDialogOpen}
            setMovingItem={setMovingItem}
            setIsMoveDialogOpen={setIsMoveDialogOpen}
          />
        ))}

        {items.map((item) => (
          <MediaItemCard
            key={item.id}
            theme={theme}
            item={item}
            viewMode={viewMode}
            optimizingId={optimizingId}
            setMovingItem={setMovingItem}
            setIsMoveDialogOpen={setIsMoveDialogOpen}
            setDeletingId={setDeletingId}
            setIsDeleteDialogOpen={setIsDeleteDialogOpen}
            handleOptimize={handleOptimize}
          />
        ))}
      </div>
    );
  }
}
