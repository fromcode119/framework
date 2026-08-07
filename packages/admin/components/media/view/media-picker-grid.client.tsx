import type { IMediaItem } from '@/components/media/interfaces/media-item.interface';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { AdminTypography } from '@/lib/typography';
import { MediaPickerTile } from '@/components/media/view/media-picker-tile.client';

/** The picker's asset grid, in its three states: loading, empty, and populated. */
export class MediaPickerGrid extends PureReactor {
  @prop declare items: IMediaItem[];
  @prop declare loading: boolean;
  @prop declare emptyMessage: string;
  @prop declare selectedId: string | null;
  @prop declare onSelect: (item: IMediaItem) => void;
  @prop declare onConfirm: (item: IMediaItem) => void;

  render(): ReactNode {
    const { items, loading, emptyMessage, selectedId, onSelect, onConfirm } = this;

    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400">
          <ImageIcon size={48} className="mb-4 opacity-20" />
          <p className={AdminTypography.TYPOGRAPHY.LABEL}>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {items.map((item) => (
          <MediaPickerTile
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            onSelect={onSelect}
            onConfirm={onConfirm}
          />
        ))}
      </div>
    );
  }
}
