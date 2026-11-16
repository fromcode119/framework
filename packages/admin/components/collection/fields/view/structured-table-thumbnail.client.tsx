import type { ReactNode } from 'react';
import { PureReactor, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { MediaRelationPreviewResolver } from '@/components/collection/media-relation-preview-resolver';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** A table's media cell accepts a media relation ID as well as a stored image URL. */
export class StructuredTableThumbnail extends PureReactor {
  @prop declare value: string;
  @state private source = '';
  private revision = 0;

  componentDidMount(): void {
    void this.resolveSource();
  }

  componentDidUpdate(previous: { value: string }): void {
    if (previous.value !== this.value) void this.resolveSource();
  }

  componentWillUnmount(): void {
    this.revision += 1;
  }

  private async resolveSource(): Promise<void> {
    const revision = ++this.revision;
    const value = this.value;
    this.source = '';
    if (!value || StructuredReadOnlyFieldService.isImagePath(value)) return;

    const preview = await MediaRelationPreviewResolver.resolve(value).catch(() => null);
    if (revision === this.revision && preview?.url && (!preview.mimeType || preview.mimeType.startsWith('image/'))) {
      this.source = preview.url;
    }
  }

  render(): ReactNode {
    const source = StructuredReadOnlyFieldService.isImagePath(this.value) ? this.value : this.source;
    if (source) return <img src={source} alt="" loading="lazy" className="fc-sro-table__thumb" />;
    return (
      <span className="fc-sro-table__thumb fc-sro-table__thumb--none" title={AdminI18n.t('ui.structured.noImage')}>
        <FrameworkIcons.Image size={14} />
      </span>
    );
  }
}
