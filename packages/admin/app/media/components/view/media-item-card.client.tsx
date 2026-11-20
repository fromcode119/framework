import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type React from 'react';
import { Badge } from '@/components/ui/view/badge.client';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { Tile } from '@/components/ui/view/tile.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { FrameworkIcons } from '@fromcode119/react';
import { MediaItemCardState } from '@/app/media/components/view/media-item-card-state.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One file in the media library, as a tile or a list row.
 *
 * The top of the chain: the markup. What the card knows and what it can do live in
 * `MediaItemCardState`. Both shapes are the console's own pieces — `Tile` and `ListRow` — and both
 * carry the same menu, so a file can be worked on the same way by pointer, keyboard and thumb.
 */
export class MediaItemCard extends MediaItemCardState {
  /**
   * What can be done with the file. A theme asset has no record of its own, so it can only be looked
   * at and taken; the Theme mark on it says why its menu is the short one.
   */
  private get menu(): IDropdownItem[] {
    const { item } = this;
    const items: IDropdownItem[] = [
      { label: this.isReadOnly ? AdminI18n.t('media.details') : AdminI18n.t('media.editDetailsAltTextCaption'), icon: this.isReadOnly ? <FrameworkIcons.Info size={15} /> : <FrameworkIcons.Edit size={15} />, onClick: this.onEdit },
    ];
    // Withheld for a private file: the public address does not exist, so this would answer 404.
    if (!this.isPrivate) items.push({ label: AdminI18n.t('media.download'), icon: <FrameworkIcons.Download size={15} />, onClick: this.onDownload });
    if (this.isReadOnly) return items;
    if (['image/jpeg', 'image/jpg', 'image/png'].includes(item.mimeType)) {
      items.push({
        label: item.optimizedUrl ? AdminI18n.t('media.reOptimizeToWebp') : AdminI18n.t('media.convertToWebp'),
        detail: item.optimizedUrl ? AdminI18n.t('media.optimized', { formatSize: this.formatSize(item.optimizedSize ?? 0) }) : undefined,
        icon: <FrameworkIcons.Zap size={15} />,
        onClick: this.onOptimize,
      });
    }
    items.push({ label: AdminI18n.t('media.moveToFolder'), icon: <FrameworkIcons.External size={15} />, onClick: this.onMove });
    items.push({ label: AdminI18n.t('media.delete'), icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: this.onDelete });
    return items;
  }

  private get kind(): string {
    return this.item.mimeType.split('/')[1]?.toUpperCase() || 'FILE';
  }

  private get hasPicture(): boolean {
    return this.item.mimeType.startsWith('image/') && !this.imageFailed;
  }

  /** What the file is marked as: not public, part of the theme, has a lighter copy. */
  private get marks(): React.ReactNode {
    const { item } = this;
    if (!this.isPrivate && !this.isReadOnly && !item.optimizedUrl) return null;
    return (
      <>
        {this.isPrivate ? <Badge variant={BadgeVariant.WARNING}>{AdminI18n.t('media.private')}</Badge> : null}
        {this.isReadOnly ? <Badge variant={BadgeVariant.GRAY}>{AdminI18n.t('media.theme')}</Badge> : null}
        {item.optimizedUrl ? <Badge variant={BadgeVariant.SUCCESS}>WebP</Badge> : null}
      </>
    );
  }

  render(): React.ReactNode {
    const { item, viewMode } = this;
    const openLabel = AdminI18n.t('media.openDetailsFor', { originalName: item.originalName });
    const facts = [this.sizeLabel, this.kind].filter(Boolean).join(' · ');

    if (viewMode === ViewMode.GRID) {
      return (
        <Tile
          title={item.originalName}
          facts={facts}
          picture={this.hasPicture ? this.previewUrl : undefined}
          icon={<FrameworkIcons.File size={40} />}
          marks={this.marks}
          selected={this.selected}
          onSelect={this.isReadOnly ? undefined : this.onToggleSelected}
          menu={this.menu}
          onOpen={this.onEdit}
          openLabel={openLabel}
          onPictureError={this.onImageError}
        />
      );
    }

    return (
      <ListRow
        lead={this.isReadOnly ? undefined : <Checkbox checked={this.selected} onChange={this.onToggleSelected} />}
        icon={this.hasPicture ? <img src={this.previewUrl} alt="" onError={this.onImageError} /> : <FrameworkIcons.File size={16} />}
        title={<button type="button" className="fc-ext-row__link" onClick={this.onEdit} title={AdminI18n.t('media.openDetails')}>{item.originalName}</button>}
        badges={this.marks}
        meta={facts}
        menu={this.menu}
      />
    );
  }
}
