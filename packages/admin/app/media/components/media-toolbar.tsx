"use client";

import React from 'react';
import { Slot } from '@fromcode119/react';
import { Button } from '@/components/ui/button';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import { FrameworkIcons } from '@fromcode119/react';
import type { MediaToolbarProps } from '../media-page.interfaces';

const { Upload, FolderPlus, Loader } = FrameworkIcons;

export default class MediaToolbar extends React.Component<MediaToolbarProps> {
  render(): React.ReactNode {
    const {
      theme,
      uploading,
      fileInputRef,
      currentFolderId,
      folderPath,
      setCurrentFolderId,
      setIsFolderPromptOpen,
    } = this.props;

    return (
      <Slot
        name="admin.media.header.title"
        props={{ theme, currentFolderId, folderPath }}
        fallback={
          <CompactPageHeader
            theme={theme}
            icon={<FrameworkIcons.Media size={18} strokeWidth={2.5} />}
            title="Media Assets"
            subtitle={
              <span className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentFolderId(null)}
                  className={`font-semibold tracking-wide transition-colors ${!currentFolderId ? 'text-indigo-500' : 'text-slate-400 hover:text-indigo-600'}`}
                >
                  Root Library
                </button>
                {folderPath.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    <span className="text-slate-300 dark:text-slate-700">/</span>
                    <button
                      onClick={() => setCurrentFolderId(folder.id)}
                      className={`font-semibold tracking-wide transition-colors ${index === folderPath.length - 1 ? 'text-indigo-500' : 'text-slate-400 hover:text-indigo-600'}`}
                    >
                      {folder.name}
                    </button>
                  </React.Fragment>
                ))}
              </span>
            }
            actions={
              <>
                <Slot name="admin.media.header.actions" />
                <button
                  onClick={() => setIsFolderPromptOpen(true)}
                  className={`h-9 w-9 flex items-center justify-center rounded-lg border transition-all ${
                    theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 shadow-sm'
                  }`}
                >
                  <FolderPlus size={16} strokeWidth={2.5} />
                </button>
                <Button
                  className="px-4 h-9 rounded-lg font-semibold text-xs text-white"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  icon={uploading ? <Loader size={15} className="animate-spin" /> : <Upload size={15} strokeWidth={3} />}
                >
                  {uploading ? 'Synching...' : 'Upload Asset'}
                </Button>
              </>
            }
          />
        }
      />
    );
  }
}
