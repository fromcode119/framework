import type { IMediaItem } from '@/components/media/interfaces/media-item.interface';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/view/button.client';
import { UiFieldUtils } from '@/lib/ui';
import { MediaThumbnail } from '@/components/media/view/media-thumbnail.client';

/** The picker's right-hand detail pane: what the selected asset is, and the button that inserts it. */
export class MediaPickerDetails extends PureReactor {
  @prop declare item: IMediaItem | null;
  @prop declare onConfirm: (item: IMediaItem) => void;

  @bound private handleConfirm(): void {
    if (this.item) this.onConfirm(this.item);
  }

  render(): ReactNode {
    const { item } = this;

    if (!item) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-4">
          <ImageIcon size={40} className="mb-4 opacity-10" />
          <p className={UiFieldUtils.TEXT.SUBTEXT}>Select an item to view details</p>
        </div>
      );
    }

    return (
      <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
        <div className="aspect-video rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
          <MediaThumbnail item={item} contain />
        </div>

        <div>
          <h4 className={UiFieldUtils.TEXT.LABEL}>Filename</h4>
          <p className="text-[11px] font-semibold text-slate-900 dark:text-white truncate">{item.filename}</p>
        </div>

        {item.relativePath ? (
          <div>
            <h4 className={UiFieldUtils.TEXT.LABEL}>Theme path</h4>
            <p className="text-[11px] font-semibold text-slate-900 dark:text-white break-all">{item.relativePath}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className={UiFieldUtils.TEXT.LABEL}>Format</h4>
            <p className="text-[11px] font-semibold text-slate-900 dark:text-white">{item.mimeType.split('/')[1]}</p>
          </div>
          {/* No size line for theme assets: the listing reports none, and a filled-in number would be invented. */}
          {item.filesize !== undefined ? (
            <div>
              <h4 className={UiFieldUtils.TEXT.LABEL}>Size</h4>
              <p className="text-[11px] font-semibold text-slate-900 dark:text-white">{(item.filesize / 1024).toFixed(1)} KB</p>
            </div>
          ) : null}
          {item.width ? (
            <div className="col-span-2">
              <h4 className={UiFieldUtils.TEXT.LABEL}>Dimensions</h4>
              <p className="text-[11px] font-semibold text-slate-900 dark:text-white">{item.width} × {item.height} px</p>
            </div>
          ) : null}
        </div>

        <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
          <Button
            onClick={this.handleConfirm}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.02] transition-transform"
          >
            <span className="text-[11px] font-semibold">Insert Asset</span>
          </Button>
        </div>
      </div>
    );
  }
}
