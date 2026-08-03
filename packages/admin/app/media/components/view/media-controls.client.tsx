import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type { ReactNode } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/reactor';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import { AdminClass } from '@/lib/admin-class';

export class MediaControls extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare uploading: boolean;
  @prop declare isDragOver: boolean;
  @prop declare error: string | null;
  @prop declare searchQuery: string;
  @prop declare viewMode: ViewMode;
  @prop declare fileInputRef: Ref<HTMLInputElement>;
  @prop declare currentFolderId: number | null;
  @prop declare folderPath: IMediaFolder[];
  @prop declare setCurrentFolderId: (id: number | null) => void;
  @prop declare setIsFolderPromptOpen: (value: boolean) => void;
  @prop declare setSearchQuery: (value: string) => void;
  @prop declare setViewMode: (mode: ViewMode) => void;
  @prop declare setError: (value: string | null) => void;
  @prop declare handleDragEnter: (e: DragEvent) => void;
  @prop declare handleDragOver: (e: DragEvent) => void;
  @prop declare handleDragLeave: (e: DragEvent) => void;
  @prop declare handleDrop: (e: DragEvent) => Promise<void>;

  @bound
  protected browseFiles(): void {
    this.fileInputRef.current?.click();
  }

  @bound
  protected dismissError(): void {
    this.setError(null);
  }

  @bound
  protected onSearchChange(e: ChangeEvent<HTMLInputElement>): void {
    this.setSearchQuery(e.target.value);
  }

  @bound
  protected selectGridView(): void {
    this.setViewMode(ViewMode.GRID);
  }

  @bound
  protected selectListView(): void {
    this.setViewMode(ViewMode.LIST);
  }

  render(): ReactNode {
    const { theme, uploading, isDragOver, error, searchQuery, viewMode } = this;

    return (
      <>
        <div
          onDragEnter={this.handleDragEnter}
          onDragOver={this.handleDragOver}
          onDragLeave={this.handleDragLeave}
          onDrop={this.handleDrop}
          className={`rounded-xl border-2 border-dashed transition-all p-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-500/10'
              : theme === ThemeMode.DARK
                ? 'border-slate-700 bg-slate-900/30'
                : 'border-slate-300 bg-slate-50/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDragOver ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}>
              <FrameworkIcons.Upload size={18} />
            </div>
            <div className="text-sm">
              <div className={`font-semibold ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
                {isDragOver ? 'Drop files to upload' : 'Drag files here'}
              </div>
              <div className="text-xs text-slate-500">Upload images, videos, or documents to the current folder.</div>
            </div>
          </div>
          <Button size={FieldSize.SM} onClick={this.browseFiles} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Browse Files'}
          </Button>
        </div>

        {error && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${theme === ThemeMode.DARK ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
            <FrameworkIcons.Alert size={18} />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={this.dismissError} className="ml-auto hover:opacity-70">
              <FrameworkIcons.Close size={16} />
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group w-full">
            <FrameworkIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search media..."
              value={searchQuery}
              onChange={this.onSearchChange}
              className={`w-full ${AdminClass.SURFACE} py-2 pl-12 pr-4 text-[13px] outline-none border transition-all ${theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`}
            />
          </div>
          <div className={`flex items-center border rounded-xl p-0.5 transition-all duration-300 shadow-sm ${
            theme === ThemeMode.DARK
              ? 'bg-slate-900 border-slate-800'
              : 'bg-slate-100/80 border-slate-200/60'
          }`}>
            <button
              onClick={this.selectGridView}
              className={`p-1.5 rounded-lg transition-all ${viewMode === ViewMode.GRID
                ? (theme === ThemeMode.DARK ? 'bg-slate-800 text-indigo-400' : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50')
                : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FrameworkIcons.Grid size={16} />
            </button>
            <button
              onClick={this.selectListView}
              className={`p-1.5 rounded-lg transition-all ${viewMode === ViewMode.LIST
                ? (theme === ThemeMode.DARK ? 'bg-slate-800 text-indigo-400' : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50')
                : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FrameworkIcons.List size={16} />
            </button>
          </div>
        </div>
      </>
    );
  }
}
