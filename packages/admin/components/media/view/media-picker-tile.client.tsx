import type { IMediaItem } from '@/components/media/interfaces/media-item.interface';
import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Tile } from '@/components/ui/view/tile.client';
import { AdminServices } from '@/lib/admin-services';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One file in the picker, as the library draws it: the picture, the name, one line of facts.
 *
 * Pressing the picture chooses it; pressing it twice inserts it. A private file is previewed through
 * the admin's own guarded address, as in the library — its public URL does not exist, and asking for it
 * painted a broken image over a file that is fine.
 */
export class MediaPickerTile extends PureReactor {
  @prop declare item: IMediaItem;
  @prop declare selected: boolean;
  @prop declare onSelect: (item: IMediaItem) => void;
  @prop declare onConfirm: (item: IMediaItem) => void;

  /** Set when the bytes cannot be loaded, so the tile shows the file's icon instead of a broken glyph. */
  @state private failed = false;

  @bound private choose(): void {
    this.onSelect(this.item);
  }

  @bound private insert(): void {
    this.onConfirm(this.item);
  }

  @bound private onPictureError(): void {
    this.failed = true;
  }

  private get preview(): string {
    return AdminServices.getInstance().media.resolvePreviewUrl(this.item);
  }

  /** Size and dimensions when they are known; a theme asset says where in the theme it lives. */
  private get facts(): string {
    const { item } = this;
    if (item.relativePath) return item.relativePath;
    const size = Number(item.fileSize) > 0 ? AdminServices.getInstance().formatter.formatSize(Number(item.fileSize)) : '';
    const pixels = item.width && item.height ? AdminI18n.t('mediaPicker.pixels', { width: item.width, height: item.height }) : '';
    return [size, pixels].filter(Boolean).join(' · ');
  }

  private get name(): string {
    return this.item.originalName || this.item.filename;
  }

  render(): ReactNode {
    const { item } = this;
    const image = item.mimeType.startsWith('image/') && !this.failed;
    const video = item.mimeType.startsWith('video/') && !this.failed;
    return (
      <div onDoubleClick={this.insert}>
        <Tile
          title={this.name}
          facts={this.facts}
          picture={image ? this.preview : undefined}
          video={video ? this.preview : undefined}
          icon={<FrameworkIcons.File size={40} />}
          selected={this.selected}
          onOpen={this.choose}
          openLabel={this.name}
          onPictureError={this.onPictureError}
        />
      </div>
    );
  }
}
