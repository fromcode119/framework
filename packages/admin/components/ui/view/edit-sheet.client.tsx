import { OverlayPresence } from '@/components/ui/overlay-presence';
import { Kbd } from '@/components/ui/view/kbd.client';
import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound, Platform } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EditSheetUnsaved } from '@/components/ui/view/edit-sheet-unsaved';

/**
 * The one place a piece of a record is edited: a panel with a title, the fields, and Cancel / Save.
 *
 * On a phone it rises from the bottom edge across the full width; from 640px it is a dialog centred over
 * the record. Which of the two is decided by `admin.css` alone. It draws NOTHING of its own look in this file — every colour, radius
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
  @prop declare onSave?: () => void;
  @prop declare saving?: boolean;
  /** A save that failed, in words; shown above the buttons. */
  @prop declare error?: string;
  @prop declare saveLabel?: string;
  @prop declare cancelLabel?: string;
  /**
   * The buttons, when the drawer is not editing a piece of a record: a preview and a restore, an
   * install and a cancel. Given one, `onSave`, `saveLabel` and `cancelLabel` are not read — the
   * caller owns the foot. Without one the drawer keeps its own Cancel / Save.
   */
  @prop declare foot?: ReactNode;
  @prop declare children: ReactNode;
  /** What a field's pending change asks for, when Save was pressed while it was still on screen. */
  @state private held = '';
  private panel: HTMLDivElement | null = null;

  // The page stops scrolling under the sheet only on a phone, where it floats; `admin.css` does that.
  componentDidMount(): void {
    if (Platform.isBrowser) document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount(): void {
    this.presence.dispose();
    if (Platform.isBrowser) document.removeEventListener('keydown', this.onKeyDown);
  }

  @bound private onKeyDown(event: KeyboardEvent): void {
    if (this.isOpen && event.key === 'Escape' && !this.saving) this.onClose();
  }

  @bound private close(): void {
    if (this.saving) return;
    this.held = '';
    this.onClose();
  }

  /** A field that applies its change by its own action holds Save while that change is pending (`EditSheetUnsaved`). */
  @bound private save(): void {
    this.held = EditSheetUnsaved.message(this.panel);
    if (!this.held) this.onSave?.();
  }

  @bound private keepPanel(node: HTMLDivElement | null): void {
    this.panel = node;
  }

  /** Keeps it drawn while it leaves — see OverlayPresence. */
  private presence = new OverlayPresence(() => this.forceUpdate());

  render(): ReactNode {
    const shown = Platform.isBrowser ? this.presence.state(this.isOpen) : null;
    if (!shown) return null;
    const sheet = AdminClass.of('sheet');
    /*
     * Through a portal, onto `body`.
     *
     * It used to be drawn where it stood, which was right while a desktop sheet was PART of the card it
     * edits. It is a dialog over the whole record now, and a fixed overlay obeys the nearest ancestor
     * that makes a stacking context, not the page: rendered inside the card, its z-index counted only
     * among the card's own children, so the navigation drew straight over it. `body` has no ancestor to
     * lose to.
     */
    return this.portal(
      <div className={sheet} data-state={shown} aria-hidden={shown === 'closed' || undefined} role={shown === 'open' ? 'dialog' : undefined} aria-label={this.title}>
        <div className={`${sheet}__backdrop`} onClick={this.close} />
        <div className={`${sheet}__panel`} ref={this.keepPanel}>
          <div className={`${sheet}__head`}>
            <div className={`${sheet}__heading`}>
              <h2 className={`${sheet}__title`}>{this.title}</h2>
              {this.subtitle ? <div className={`${sheet}__subtitle`}>{this.subtitle}</div> : null}
            </div>
            {/* The key that closes it, said out loud beside the ✕ — the reference puts `esc` there,
                and a drawer that can be dismissed from the keyboard should say so. */}
            <Kbd className={`${sheet}__esc`}>esc</Kbd>
            <button type="button" className={`${sheet}__close`} onClick={this.close} aria-label={AdminI18n.t('common.close')}>
              <FrameworkIcons.Close size={18} />
            </button>
          </div>
          <div className={`${sheet}__body`}>{this.children}</div>
          {this.held || this.error ? <div className={`${sheet}__error`} role="alert">{this.held || this.error}</div> : null}
          <div className={`${sheet}__foot`}>
            {this.foot ?? (
              <>
                <Button type="button" variant={ButtonVariant.OUTLINE} onClick={this.close} disabled={this.saving}>
                  {this.cancelLabel ?? AdminI18n.t('common.cancel')}
                </Button>
                <Button type="button" variant={ButtonVariant.PRIMARY} onClick={this.save} isLoading={this.saving}>
                  {this.saveLabel ?? AdminI18n.t('common.save')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}
