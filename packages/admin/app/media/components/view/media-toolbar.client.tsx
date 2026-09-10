import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import { Fragment } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { DragEvent } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { Select } from '@/components/ui/view/select.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
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
  @prop declare source: string;
  @prop declare setSource: (value: string) => void;
  @prop declare selectedCount: number;
  @prop declare onShareSelected: () => void;
  @prop declare onClearSelection: () => void;
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
                <Button
                  variant={ButtonVariant.SECONDARY}
                  className="px-3 h-9 rounded-lg font-semibold text-xs whitespace-nowrap"
                  onClick={this.openFolderPrompt}
                  icon={<FrameworkIcons.FolderPlus size={15} strokeWidth={2.5} />}
                >
                  New folder
                </Button>
                {/* Uploads and theme assets are merged by default — "find that picture" is one job.
                    The filter is for when the distinction actually matters. */}
                {/* Only present when something is ticked: sharing acts on a selection, so an always-on
                    button would have nothing to act upon. */}
                {this.selectedCount > 0 ? (
                  <>
                    <Button
                      className="px-4 h-9 rounded-lg font-semibold text-xs whitespace-nowrap"
                      variant={ButtonVariant.GHOST}
                      onClick={this.onClearSelection}
                    >
                      Clear ({this.selectedCount})
                    </Button>
                    <Button
                      className="px-4 h-9 rounded-lg font-semibold text-xs text-white whitespace-nowrap"
                      onClick={this.onShareSelected}
                      icon={<FrameworkIcons.Share size={15} strokeWidth={3} />}
                    >
                      Share {this.selectedCount}
                    </Button>
                  </>
                ) : null}
                <Button
                  className="px-4 h-9 rounded-lg font-semibold text-xs text-white whitespace-nowrap"
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
