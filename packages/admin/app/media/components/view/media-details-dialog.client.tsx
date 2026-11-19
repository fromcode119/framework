import type { ChangeEvent, ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { Hint } from '@/components/ui/view/hint.client';
import { AdminServices } from '@/lib/admin-services';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** A file's own words and where its bytes are kept, edited in the console's sheet. */
export class MediaDetailsDialog extends AdminComponent {
  @prop declare item: IMediaItem | null;
  @prop declare isLoading: boolean;
  @prop declare onClose: () => void;
  @prop declare onConfirm: (alt: string, caption: string, visibility: string) => void;

  @state alt = '';
  @state caption = '';
  /** Which storage space holds the bytes. Changing it makes the server MOVE the file. */
  @state visibility = 'public';
  /** The file last shown, kept while the sheet closes so it does not empty on its way out. */
  private shown: IMediaItem | null = null;

  private take(): void {
    const item = this.item;
    if (!item) return;
    this.alt = item.alt || '';
    this.caption = item.caption || '';
    this.visibility = String(item.visibility || 'public');
  }

  componentDidMount(): void {
    this.take();
  }

  componentDidUpdate(prevProps: { item: IMediaItem | null }): void {
    if (prevProps.item?.id !== this.item?.id) this.take();
  }

  @bound private save(): void {
    this.onConfirm(this.alt.trim(), this.caption.trim(), this.visibility);
  }

  @bound private handleAltChange(e: ChangeEvent<HTMLInputElement>): void {
    this.alt = e.target.value;
  }

  @bound private handleCaptionChange(e: ChangeEvent<HTMLInputElement>): void {
    this.caption = e.target.value;
  }

  @bound private handleVisibilityChange(value: string): void {
    this.visibility = value;
  }

  render(): ReactNode {
    if (this.item) this.shown = this.item;
    const item = this.shown;
    const isLoading = this.isLoading;

    return (
      <EditSheet isOpen={Boolean(this.item)} title={AdminI18n.t('media.editDetails')} subtitle={item?.originalName} onClose={this.onClose} onSave={this.save} saving={isLoading} saveLabel={AdminI18n.t('media.saveDetails')} cancelLabel={AdminI18n.t('media.cancel')}>
        {item ? (
          <div className="fc-form-stack">
            {item.mimeType.startsWith('image/') ? (
              <div className="fc-preview"><img src={AdminServices.getInstance().media.resolvePreviewUrl(item)} alt={this.alt || item.originalName} /></div>
            ) : null}
            <Input label={AdminI18n.t('media.altText')} placeholder={AdminI18n.t('media.describeTheImageForScreen')} value={this.alt} onChange={this.handleAltChange} disabled={isLoading} autoFocus />
            <Input label={AdminI18n.t('media.caption')} placeholder={AdminI18n.t('media.optionalCaptionShownWithThe')} value={this.caption} onChange={this.handleCaptionChange} disabled={isLoading} />
            <div>
              <Select
                label={AdminI18n.t('media.visibility')}
                value={this.visibility}
                onChange={this.handleVisibilityChange}
                disabled={isLoading}
                options={[
                  { value: 'public', label: AdminI18n.t('media.publicAnyoneWithTheUrl') },
                  { value: 'private', label: AdminI18n.t('media.privateOnlyReachableThroughA') },
                ]}
              />
              <Hint>{AdminI18n.t('media.changingThisMovesTheFile')}</Hint>
            </div>
          </div>
        ) : null}
      </EditSheet>
    );
  }
}
