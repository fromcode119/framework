import type { IMediaItem } from '@/components/media/interfaces/media-item.interface';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Check } from 'lucide-react';
import { MediaThumbnail } from '@/components/media/view/media-thumbnail.client';

/** A single selectable tile in the picker grid. Click selects, double-click inserts. */
export class MediaPickerTile extends PureReactor {
  @prop declare item: IMediaItem;
  @prop declare selected: boolean;
  @prop declare onSelect: (item: IMediaItem) => void;
  @prop declare onConfirm: (item: IMediaItem) => void;

  @bound private handleClick(): void {
    this.onSelect(this.item);
  }

  @bound private handleDoubleClick(): void {
    this.onConfirm(this.item);
  }

  render(): ReactNode {
    const { item, selected } = this;

    return (
      <div
        onClick={this.handleClick}
        onDoubleClick={this.handleDoubleClick}
        title={item.relativePath || item.filename}
        className={`group relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
          selected
            ? 'border-indigo-500 ring-4 ring-indigo-500/10'
            : 'border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 bg-white dark:bg-slate-800'
        }`}
      >
        <MediaThumbnail item={item} />

        {selected ? (
          <div className="absolute top-2 right-2 bg-indigo-500 text-white rounded-full p-1 shadow-lg animate-in zoom-in-0">
            <Check size={12} />
          </div>
        ) : null}

        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors pointer-events-none" />
      </div>
    );
  }
}
