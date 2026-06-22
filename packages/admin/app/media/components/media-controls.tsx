"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import type { MediaToolbarProps } from '../media-page.interfaces';

const { Upload, Search, Grid, List, Alert } = FrameworkIcons;

export default class MediaControls extends React.Component<MediaToolbarProps> {
  render(): React.ReactNode {
    const {
      theme,
      uploading,
      isDragOver,
      error,
      searchQuery,
      viewMode,
      fileInputRef,
      setSearchQuery,
      setViewMode,
      setError,
      handleDragEnter,
      handleDragOver,
      handleDragLeave,
      handleDrop,
    } = this.props;

    return (
      <>
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
      </>
    );
  }
}
