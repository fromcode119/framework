import type { ReactNode } from 'react';
import { PureReactor, prop, bound, Platform } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The one place a piece of a record is edited: a panel with a title, the fields, and Cancel / Save.
 *
 * On a phone it rises from the bottom edge across the full width. From 640px nothing floats: it is drawn
 * in place, where it is rendered, so put it inside the card whose values it edits. Which of the two is
 * decided by `admin.css` alone. It draws NOTHING of its own look in this file — every colour, radius
 * and gap is a `--fc-sheet-*` token there, so the console's style (or an appearance's) changes in one
 * place instead of on every screen that edits something.
 *
 * Saving is the caller's: the sheet only reports Save and Cancel, and stays open while `saving` is true
 * so an error the save produces is shown next to the fields that caused it.
 */
export class EditSheet extends PureReactor {
  @prop declare isOpen: boolean;
  @prop declare title: string;
  /** One quiet line under the title naming the record, e.g. its number. */
  @prop declare subtitle?: ReactNode;
  @prop declare onClose: () => void;
  @prop declare onSave: () => void;
  @prop declare saving?: boolean;
  /** A save that failed, in words; shown above the buttons. */
  @prop declare error?: string;
  @prop declare saveLabel?: string;
  @prop declare cancelLabel?: string;
  @prop declare children: ReactNode;

  // The page stops scrolling under the sheet only on a phone, where it floats; `admin.css` does that.
  componentDidMount(): void {
    if (Platform.isBrowser) document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount(): void {
    if (Platform.isBrowser) document.removeEventListener('keydown', this.onKeyDown);
  }

  @bound private onKeyDown(event: KeyboardEvent): void {
    if (this.isOpen && event.key === 'Escape' && !this.saving) this.onClose();
  }

  @bound private close(): void {
    if (!this.saving) this.onClose();
  }

  render(): ReactNode {
    if (!this.isOpen) return null;
    const sheet = AdminClass.of('sheet');
    // Rendered where it stands, never through a portal: from 640px it IS part of the card it edits.
    return (
      <div className={sheet} role="dialog" aria-label={this.title}>
        <div className={`${sheet}__backdrop`} onClick={this.close} />
        <div className={`${sheet}__panel`}>
          <div className={`${sheet}__head`}>
            <div className={`${sheet}__heading`}>
              <h2 className={`${sheet}__title`}>{this.title}</h2>
              {this.subtitle ? <div className={`${sheet}__subtitle`}>{this.subtitle}</div> : null}
            </div>
            <button type="button" className={`${sheet}__close`} onClick={this.close} aria-label={AdminI18n.t('common.close')}>
              <FrameworkIcons.Close size={18} />
            </button>
          </div>
          <div className={`${sheet}__body`}>{this.children}</div>
          {this.error ? <div className={`${sheet}__error`} role="alert">{this.error}</div> : null}
          <div className={`${sheet}__foot`}>
            <Button type="button" variant={ButtonVariant.OUTLINE} onClick={this.close} disabled={this.saving}>
              {this.cancelLabel ?? AdminI18n.t('common.cancel')}
            </Button>
            <Button type="button" variant={ButtonVariant.PRIMARY} onClick={this.onSave} isLoading={this.saving}>
              {this.saveLabel ?? AdminI18n.t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
