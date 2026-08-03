import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type { ReactNode } from 'react';

import { PureReactor, prop, bound, Ref } from '@fromcode119/reactor';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { MediaFolderCard } from '@/app/media/components/view/media-folder-card.client';
import { MediaItemCard } from '@/app/media/components/view/media-item-card.client';
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';

export class MediaGrid extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare loading: boolean;
  @prop declare items: IMediaItem[];
  @prop declare folders: IMediaFolder[];
  @prop declare viewMode: ViewMode;
  @prop declare optimizingId: number | null;
  @prop declare fileInputRef: Ref<HTMLInputElement>;
  @prop declare setCurrentFolderId: (id: number | null) => void;
  @prop declare setEditingFolder: (folder: IMediaFolder | null) => void;
  @prop declare setIsRenamePromptOpen: (value: boolean) => void;
  @prop declare setIsFolderDeleteDialogOpen: (value: boolean) => void;
  @prop declare setMovingItem: (item: IMovingItem | null) => void;
  @prop declare setIsMoveDialogOpen: (value: boolean) => void;
  @prop declare setDeletingId: (id: number | null) => void;
  @prop declare setIsDeleteDialogOpen: (value: boolean) => void;
  @prop declare setEditingItem: (item: IMediaItem | null) => void;
  @prop declare handleOptimize: (item: IMediaItem) => Promise<void>;

  @bound
  private openFilePicker(): void {
    this.fileInputRef.current?.click();
  }

  render(): ReactNode {
    const theme = this.theme;
    const viewMode = this.viewMode;

    if (this.loading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
           <FrameworkIcons.Loader className="animate-spin text-indigo-500" size={48} />
           <p className="text-slate-500">Loading your assets...</p>
        </div>
      );
    }

    if (this.items.length === 0 && this.folders.length === 0) {
      return (
        <div className={`flex flex-col items-center justify-center py-24 rounded-xl border-2 border-dashed ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
           <div className="p-4 bg-indigo-500/10 rounded-full text-indigo-500 mb-4 text-3xl">
              <FrameworkIcons.Media />
           </div>
           <h3 className={`text-xl font-bold ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>No assets yet</h3>
           <p className="text-slate-500 mt-2">Upload your first image, video or document to get started.</p>
           <Button size={FieldSize.SM} className="mt-6" onClick={this.openFilePicker}>
              <FrameworkIcons.Upload size={18} />
              <span>Upload Now</span>
           </Button>
        </div>
      );
    }

    return (
      <div className={viewMode === ViewMode.GRID ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" : "space-y-2"}>
        {this.folders.map(folder => (
          <MediaFolderCard
            key={`folder-${folder.id}`}
            theme={theme}
            folder={folder}
            viewMode={viewMode}
            setCurrentFolderId={this.setCurrentFolderId}
            setEditingFolder={this.setEditingFolder}
            setIsRenamePromptOpen={this.setIsRenamePromptOpen}
            setIsFolderDeleteDialogOpen={this.setIsFolderDeleteDialogOpen}
            setMovingItem={this.setMovingItem}
            setIsMoveDialogOpen={this.setIsMoveDialogOpen}
          />
        ))}

        {this.items.map((item) => (
          <MediaItemCard
            key={item.id}
            theme={theme}
            item={item}
            viewMode={viewMode}
            optimizingId={this.optimizingId}
            setMovingItem={this.setMovingItem}
            setIsMoveDialogOpen={this.setIsMoveDialogOpen}
            setDeletingId={this.setDeletingId}
            setIsDeleteDialogOpen={this.setIsDeleteDialogOpen}
            setEditingItem={this.setEditingItem}
            handleOptimize={this.handleOptimize}
          />
        ))}
      </div>
    );
  }
}
