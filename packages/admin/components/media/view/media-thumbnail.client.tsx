import type { IMediaItem } from '@/components/media/interfaces/media-item.interface';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { File as FileIcon } from 'lucide-react';

/**
 * One asset rendered as the kind of thing it actually is: images as `<img>`, videos as a real
 * `<video>`, everything else as a named file card.
 *
 * A video path handed to `<img>` renders as a broken-image glyph, which reads as "this value is
 * wrong" when the value is perfectly fine — the preview was.
 */
export class MediaThumbnail extends PureReactor {
  @prop declare item: IMediaItem;
  /** Fit the whole asset inside the box (detail view) instead of filling it (grid tile). */
  @prop declare contain?: boolean;

  private get fitClass(): string {
    return this.contain ? 'object-contain' : 'object-cover';
  }

  render(): ReactNode {
    const { item } = this;

    if (item.mimeType.startsWith('image/')) {
      return <img src={item.url} alt={item.filename} className={`w-full h-full ${this.fitClass}`} />;
    }

    if (item.mimeType.startsWith('video/')) {
      return (
        <video
          src={item.url}
          className={`w-full h-full ${this.fitClass}`}
          controls={this.contain}
          muted
          playsInline
          preload="metadata"
        />
      );
    }

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <FileIcon size={32} className="text-slate-300 mb-2" />
        <span className="text-[9px] font-semibold text-slate-400 text-center truncate w-full">{item.filename}</span>
      </div>
    );
  }
}
