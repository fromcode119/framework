import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import { Fragment } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { DragEvent } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
export class MediaToolbar extends PureReactor {
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
  private goToRoot(): void {
    this.setCurrentFolderId(null);
  }

  @bound
  private goToFolder(event: MouseEvent<HTMLButtonElement>): void {
    const folderId = Number(event.currentTarget.dataset.folderId);
    this.setCurrentFolderId(Number.isFinite(folderId) ? folderId : null);
  }

  @bound
  private openFolderPrompt(): void {
    this.setIsFolderPromptOpen(true);
  }

  @bound
  private openFilePicker(): void {
    this.fileInputRef.current?.click();
  }

  render(): ReactNode {
    const { theme, uploading, currentFolderId, folderPath } = this;

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
                  onClick={this.goToRoot}
                  className={`font-semibold tracking-wide transition-colors ${!currentFolderId ? 'text-indigo-500' : 'text-slate-400 hover:text-indigo-600'}`}
                >
                  Root Library
                </button>
                {folderPath.map((folder, index) => (
                  <Fragment key={folder.id}>
                    <span className="text-slate-300 dark:text-slate-700">/</span>
                    <button
                      data-folder-id={folder.id}
                      onClick={this.goToFolder}
                      className={`font-semibold tracking-wide transition-colors ${index === folderPath.length - 1 ? 'text-indigo-500' : 'text-slate-400 hover:text-indigo-600'}`}
                    >
                      {folder.name}
                    </button>
                  </Fragment>
                ))}
              </span>
            }
            actions={
              <>
                <Slot name="admin.media.header.actions" />
                <button
                  onClick={this.openFolderPrompt}
                  className={`h-9 w-9 flex items-center justify-center rounded-lg border transition-all ${
                    theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 shadow-sm'
                  }`}
                >
                  <FrameworkIcons.FolderPlus size={16} strokeWidth={2.5} />
                </button>
                <Button
                  className="px-4 h-9 rounded-lg font-semibold text-xs text-white"
                  onClick={this.openFilePicker}
                  disabled={uploading}
                  icon={uploading ? <FrameworkIcons.Loader size={15} className="animate-spin" /> : <FrameworkIcons.Upload size={15} strokeWidth={3} />}
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
