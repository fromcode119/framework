import type { ReactNode } from 'react';
import { prop, state, watch } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { MediaRelationFieldUtils } from '@/components/collection/media-relation-field-utils';
import { MediaRelationPreviewResolver } from '@/components/collection/media-relation-preview-resolver';
import type { IMediaRelationPreview } from '@/components/collection/interfaces/media-relation-preview.interface';

/**
 * A media field in a list row: the first file as a thumbnail (an image) or a file icon (anything
 * else), and how many more the field holds. A list repeats the same files across rows and pages, so
 * each file is looked up once.
 */
export class CollectionListMediaCellValue extends AdminComponent {
  private static readonly PREVIEWS = new Map<string, Promise<IMediaRelationPreview | null>>();

  @prop declare raw: any;

  @state private preview: IMediaRelationPreview | null = null;
  private runToken = 0;

  private get ids(): string[] {
    return MediaRelationFieldUtils.getSelectedIds(this.raw).map(String);
  }

  private static previewOf(id: string): Promise<IMediaRelationPreview | null> {
    let pending = CollectionListMediaCellValue.PREVIEWS.get(id);
    if (!pending) {
      pending = MediaRelationPreviewResolver.resolve(id);
      CollectionListMediaCellValue.PREVIEWS.set(id, pending);
    }
    return pending;
  }

  private async load(): Promise<void> {
    const token = ++this.runToken;
    const first = this.ids[0];
    const preview = first ? await CollectionListMediaCellValue.previewOf(first) : null;
    if (token === this.runToken) this.preview = preview;
  }

  componentDidMount(): void {
    void this.load();
  }

  @watch('raw')
  private onRawChanged(): void {
    void this.load();
  }

  componentWillUnmount(): void {
    this.runToken++;
  }

  private get isImage(): boolean {
    return Boolean(this.preview?.url) && MediaRelationFieldUtils.mimeTypeOf(this.preview!).startsWith('image/');
  }

  render(): ReactNode {
    const count = this.ids.length;
    if (!count) return <>-</>;
    const preview = this.preview;
    return (
      <span className="inline-flex items-center gap-2" title={preview?.filename || undefined}>
        <span className="w-10 h-10 shrink-0 rounded-md overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 inline-flex items-center justify-center text-slate-400">
          {this.isImage
            ? <img src={preview!.url} alt={preview!.filename || ''} loading="lazy" className="w-full h-full object-cover" />
            : <FrameworkIcons.File size={16} />}
        </span>
        {count > 1 ? <span className="text-[11px] font-semibold text-slate-500">+{count - 1}</span> : null}
      </span>
    );
  }
}
