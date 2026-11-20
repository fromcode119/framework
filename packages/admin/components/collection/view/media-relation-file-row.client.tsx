import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { MediaRelationFieldUtils } from '@/components/collection/media-relation-field-utils';
import type { IMediaRelationPreview } from '@/components/collection/interfaces/media-relation-preview.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** One selected file of a media field: what it is (thumbnail or file icon), its name, and a way to remove it. */
export class MediaRelationFileRow extends PureReactor {
  @prop declare preview: IMediaRelationPreview;
  @prop declare onRemove: (id: string) => void;

  @bound private handleRemove(): void {
    this.onRemove(String(this.preview.id));
  }

  private get isImage(): boolean {
    return MediaRelationFieldUtils.mimeTypeOf(this.preview).startsWith('image/');
  }

  render(): ReactNode {
    const { preview } = this;
    const filename = preview.filename || String(preview.id);
    return (
      <div className="flex items-center gap-3 px-2 h-12 rounded-[var(--fc-control-radius)] border fc-tone-line fc-tone-surface">
        <div className="w-8 h-8 shrink-0 rounded overflow-hidden fc-tone-raised flex items-center justify-center fc-tone-muted">
          {this.isImage && preview.url
            ? <img src={preview.url} alt="" className="w-full h-full object-cover" />
            : <FrameworkIcons.File size={16} />}
        </div>
        <a href={preview.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-xs font-medium fc-tone-text hover:underline">
          {filename}
        </a>
        <button
          type="button"
          onClick={this.handleRemove}
          aria-label={AdminI18n.t('ui.media.remove', { name: filename })}
          title={AdminI18n.t('ui.media.remove', { name: filename })}
          className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded fc-tone-muted fc-tone-hover-danger fc-tone-hover-danger-soft"
        >
          <FrameworkIcons.X size={14} />
        </button>
      </div>
    );
  }
}
