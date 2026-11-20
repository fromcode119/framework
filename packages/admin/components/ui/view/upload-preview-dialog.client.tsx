import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { FrameworkIcons } from '@fromcode119/react';
import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What an upload is about to install, listed by section, before it is installed.
 *
 * The dialog itself is the console's: scrim, panel, head and foot come from {@link Dialog}. This one
 * supplies the lists.
 */
export class UploadPreviewDialog extends PureReactor {
  @prop declare isOpen: boolean;
  @prop declare title: string;
  @prop declare description?: string;
  @prop declare sections: IUploadPreviewSection[];
  @prop declare confirmLabel?: string;
  @prop declare cancelLabel?: string;
  @prop declare isLoading?: boolean;
  @prop declare onClose: () => void;
  @prop declare onConfirm: () => void;

  private get foot(): ReactNode {
    const confirmLabel = this.confirmLabel ?? AdminI18n.t('ui.upload.install');
    const cancelLabel = this.cancelLabel ?? AdminI18n.t('common.cancel');
    return (
      <>
        <Button variant={ButtonVariant.GHOST} onClick={this.onClose} disabled={this.isLoading ?? false}>
          {cancelLabel}
        </Button>
        <Button variant={ButtonVariant.PRIMARY} onClick={this.onConfirm} isLoading={this.isLoading ?? false}>
          {confirmLabel}
        </Button>
      </>
    );
  }

  render(): ReactNode {
    return (
      <EditSheet
        isOpen={this.isOpen}
        onClose={this.onClose}
        title={this.title}
        subtitle={this.description}
        saving={this.isLoading ?? false}
        foot={this.foot}
      >
        <div className="fc-upload-preview">
          {this.sections.map((section) => (
            <section key={section.title} className="fc-upload-preview__section">
              <h4 className="fc-upload-preview__heading">{section.title}</h4>
              <ul className="fc-upload-preview__list">
                {section.items.length === 0
                  ? <li className="fc-upload-preview__none">{AdminI18n.t('common.none')}</li>
                  : section.items.map((item, index) => (
                    <li key={`${section.title}-${index}`} className="fc-upload-preview__item">{item}</li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </EditSheet>
    );
  }
}
