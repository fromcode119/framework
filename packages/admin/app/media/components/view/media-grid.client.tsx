import { Loader } from '@/components/ui/view/loader.client';
import { ListCard } from '@/components/ui/view/list-card.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type { ReactNode } from 'react';

import { PureReactor, prop, bound, Ref } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { MediaFolderCard } from '@/app/media/components/view/media-folder-card.client';
import { MediaItemCard } from '@/app/media/components/view/media-item-card.client';
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
  @prop declare selectedIds: number[];
  @prop declare toggleSelected: (id: number) => void;
  @prop declare handleOptimize: (item: IMediaItem) => Promise<void>;

  @bound
  private openFilePicker(): void {
    this.fileInputRef.current?.click();
  }

  render(): ReactNode {
    const theme = this.theme;
    const viewMode = this.viewMode;

    if (this.loading) return <Loader label={AdminI18n.t('media.loadingYourAssets')} />;

    if (this.items.length === 0 && this.folders.length === 0) {
      return (
        <ListCard empty={(
          <EmptyState
            icon={<FrameworkIcons.Media size={18} />}
            title={AdminI18n.t('media.noAssetsYet')}
            hint={AdminI18n.t('media.uploadYourFirstImageVideo')}
            action={<Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Upload size={15} />} onClick={this.openFilePicker}>{AdminI18n.t('media.uploadNow')}</Button>}
          />
        )} />
      );
    }

    return (
      <div className={viewMode === ViewMode.GRID ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4" : "space-y-2"}>
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
            selected={this.selectedIds.includes(Number(item.id))}
            toggleSelected={this.toggleSelected}
            handleOptimize={this.handleOptimize}
          />
        ))}
      </div>
    );
  }
}
