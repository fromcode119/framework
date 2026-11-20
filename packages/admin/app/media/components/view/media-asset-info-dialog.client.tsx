import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { Platform, bound, prop } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Dialog } from '@/components/ui/view/dialog.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { AdminServices } from '@/lib/admin-services';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the library knows about an asset it cannot change.
 *
 * A theme asset ships inside the theme bundle: there is no record behind it, so the edit dialog has
 * nothing to save and rendering it would offer an Alt-text box that writes nowhere. Clicking the tile
 * still has to answer something — the operator clicked a picture to find out what it is — so it opens
 * THIS instead: the file's own facts, and the two things that can actually be done with it (open the
 * file, download it). Every line is read off the asset; a fact the listing did not report is omitted
 * rather than shown as an empty or zero value.
 */
export class MediaAssetInfoDialog extends AdminComponent {
  @prop declare item: IMediaItem | null;
  @prop declare onClose: () => void;

  private get mediaUrl(): string {
    return AdminServices.getInstance().media.resolveMediaUrl(this.item?.url || '');
  }

  /** Every fact the asset actually reports — nothing invented, nothing blank. */
  private get facts(): Array<{ key: string; label: string; value: string }> {
    const item = this.item;
    if (!item) return [];
    const rows = [{ key: 'name', label: AdminI18n.t('media.fileName'), value: item.originalName }];
    if (item.relativePath) rows.push({ key: 'path', label: AdminI18n.t('media.pathInTheme'), value: item.relativePath });
    rows.push({ key: 'type', label: AdminI18n.t('media.type'), value: item.mimeType });
    const bytes = Number(item.fileSize);
    if (Number.isFinite(bytes) && bytes > 0) rows.push({ key: 'size', label: AdminI18n.t('media.size'), value: AdminServices.getInstance().formatter.formatSize(bytes) });
    if (item.width && item.height) rows.push({ key: 'dimensions', label: AdminI18n.t('media.dimensions'), value: `${item.width} × ${item.height}` });
    rows.push({ key: 'url', label: 'URL', value: item.url });
    return rows;
  }

  @bound private openFile(): void {
    if (Platform.isBrowser) window.open(this.mediaUrl, '_blank', 'noopener,noreferrer');
  }

  render(): ReactNode {
    const item = this.item;
    if (!item) return null;
    return (
      <Dialog isOpen wide onClose={this.onClose} title={AdminI18n.t('media.assetDetails')} description={AdminI18n.t('media.thisFileShipsInsideThe')}
        foot={<>
          <Button variant={ButtonVariant.SECONDARY} onClick={this.onClose}>{AdminI18n.t('media.close')}</Button>
          <Button variant={ButtonVariant.PRIMARY} onClick={this.openFile}>{AdminI18n.t('media.openFile')}</Button>
        </>}>
        <div className="fc-form-stack">
          {item.mimeType.startsWith('image/') ? <div className="fc-preview"><img src={this.mediaUrl} alt={item.originalName} /></div> : null}
          <AdminFactGrid facts={this.facts as any} />
        </div>
      </Dialog>
    );
  }
}
