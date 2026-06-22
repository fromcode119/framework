"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@fromcode119/react';
import type { MediaFolderCardProps } from '../media-page.interfaces';

const { Folder, Edit, External, Trash } = FrameworkIcons;

export default class MediaFolderCard extends React.Component<MediaFolderCardProps> {
  render(): React.ReactNode {
    const {
      theme,
      folder,
      viewMode,
      setCurrentFolderId,
      setEditingFolder,
      setIsRenamePromptOpen,
      setIsFolderDeleteDialogOpen,
      setMovingItem,
      setIsMoveDialogOpen,
    } = this.props;

    return (
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
    );
  }
}
