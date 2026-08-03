import { MovingItemType } from '@/app/media/enums/moving-item-type.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type { MouseEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';

export class MediaFolderCard extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare folder: IMediaFolder;
  @prop declare viewMode: ViewMode;
  @prop declare setCurrentFolderId: (id: number | null) => void;
  @prop declare setEditingFolder: (folder: IMediaFolder | null) => void;
  @prop declare setIsRenamePromptOpen: (value: boolean) => void;
  @prop declare setIsFolderDeleteDialogOpen: (value: boolean) => void;
  @prop declare setMovingItem: (item: IMovingItem | null) => void;
  @prop declare setIsMoveDialogOpen: (value: boolean) => void;

  @bound
  open(): void {
    this.setCurrentFolderId(this.folder.id);
  }

  @bound
  rename(event: MouseEvent): void {
    event.stopPropagation();
    this.setEditingFolder(this.folder);
    this.setIsRenamePromptOpen(true);
  }

  @bound
  move(event: MouseEvent): void {
    event.stopPropagation();
    this.setMovingItem({ id: this.folder.id, type: MovingItemType.FOLDER });
    this.setIsMoveDialogOpen(true);
  }

  @bound
  remove(event: MouseEvent): void {
    event.stopPropagation();
    this.setEditingFolder(this.folder);
    this.setIsFolderDeleteDialogOpen(true);
  }

  render(): ReactNode {
    const { theme, folder, viewMode } = this;

    return (
      <Card
        key={`folder-${folder.id}`}
        className={`group cursor-pointer hover:border-indigo-500/50 transition-all relative rounded-xl ${viewMode === ViewMode.LIST ? 'p-3 flex items-center gap-4' : 'p-6 flex flex-col items-center justify-center text-center'}`}
        onClick={this.open}
      >
        <div className={`p-3 rounded-xl ${theme === ThemeMode.DARK ? 'bg-amber-500/10 text-amber-500' : 'bg-amber-50 text-amber-600'}`}>
          <FrameworkIcons.Folder size={viewMode === ViewMode.GRID ? 32 : 20} />
        </div>
        <div className={viewMode === ViewMode.GRID ? "mt-4" : ""}>
          <div className={`font-semibold ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>{folder.name}</div>
          {viewMode === ViewMode.GRID && <div className="text-[10px] text-slate-500 tracking-wide font-semibold mt-1">Folder</div>}
        </div>

        <div className={`absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${viewMode === ViewMode.LIST ? 'static ml-auto opacity-100' : ''}`}>
           <button
            onClick={this.rename}
            className={`p-2 rounded-lg transition-colors ${theme === ThemeMode.DARK ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-white shadow-sm border border-slate-100 hover:bg-slate-50 text-slate-500'}`}
          >
            <FrameworkIcons.Edit size={14} />
          </button>
           <button
            onClick={this.move}
            className={`p-2 rounded-lg transition-colors ${theme === ThemeMode.DARK ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-white shadow-sm border border-slate-100 hover:bg-slate-50 text-slate-500'}`}
          >
            <FrameworkIcons.External size={14} />
          </button>
          <button
            onClick={this.remove}
            className={`p-2 rounded-lg transition-colors ${theme === ThemeMode.DARK ? 'bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400' : 'bg-white shadow-sm border border-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600'}`}
          >
            <FrameworkIcons.Trash size={14} />
          </button>
        </div>
      </Card>
    );
  }
}
