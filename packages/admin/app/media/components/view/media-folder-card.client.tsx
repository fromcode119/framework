import { MovingItemType } from '@/app/media/enums/moving-item-type.enum';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Tile } from '@/components/ui/view/tile.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { FrameworkIcons } from '@fromcode119/react';
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** One folder of the library, as a tile or a list row: pressing it goes inside, its menu works on it. */
export class MediaFolderCard extends PureReactor {
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
  rename(): void {
    this.setEditingFolder(this.folder);
    this.setIsRenamePromptOpen(true);
  }

  @bound
  move(): void {
    this.setMovingItem({ id: this.folder.id, type: MovingItemType.FOLDER });
    this.setIsMoveDialogOpen(true);
  }

  @bound
  remove(): void {
    this.setEditingFolder(this.folder);
    this.setIsFolderDeleteDialogOpen(true);
  }

  private get menu(): IDropdownItem[] {
    return [
      { label: AdminI18n.t('media.renameFolder'), icon: <FrameworkIcons.Edit size={15} />, onClick: this.rename },
      { label: AdminI18n.t('media.moveToFolder'), icon: <FrameworkIcons.External size={15} />, onClick: this.move },
      { label: AdminI18n.t('media.deleteFolder'), icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: this.remove },
    ];
  }

  render(): ReactNode {
    const { folder } = this;
    if (this.viewMode === ViewMode.GRID) {
      return <Tile title={folder.name} facts={AdminI18n.t('media.folder')} icon={<FrameworkIcons.Folder size={40} />} menu={this.menu} onOpen={this.open} openLabel={folder.name} />;
    }
    return (
      <ListRow
        icon={<FrameworkIcons.Folder size={16} />}
        title={<button type="button" className="fc-ext-row__link" onClick={this.open}>{folder.name}</button>}
        meta={AdminI18n.t('media.folder')}
        menu={this.menu}
      />
    );
  }
}
