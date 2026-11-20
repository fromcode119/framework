import { OverlayPresence } from '@/components/ui/overlay-presence';
import { Kbd } from '@/components/ui/view/kbd.client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound, Platform } from '@fromcode119/react-class-components';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A dialog that takes the whole window, for making something that needs the room: the record pages
 * this console follows open one for creating a variant, and nothing else is on screen while it is up.
 *
 * It is the drawer's sibling, not a bigger drawer. Where `EditSheet` edits a PIECE of a record that is
 * still visible behind it, this one replaces the page: 8px in from every edge, a 45px head carrying
 * `esc` and the steps, one centred column of at most 720px, and a 61px foot with the two buttons.
 *
 * The steps are the caller's: it says which tabs there are and which one is current, and the foot's
 * label changes with it ("Continue" on the first, "Create" on the last). The modal itself holds no
 * state — it draws what it is given.
 */
export class FocusModal extends PureReactor {
  @prop declare isOpen: boolean;
  /** Named for assistive technology; it is not drawn, the steps are. */
  @prop declare label: string;
  /** The steps across the head; empty draws none. */
  @prop declare tabs?: { id: string; label: string }[];
  @prop declare activeTab?: string;
  @prop declare onTab?: (id: string) => void;
  @prop declare onClose: () => void;
  @prop declare onConfirm: () => void;
  @prop declare confirmLabel?: string;
  @prop declare cancelLabel?: string;
  @prop declare confirmDisabled?: boolean;
  @prop declare saving?: boolean;
  /** What the buttons will act on, drawn at the start of the foot ("hero.jpg"). */
  @prop declare footNote?: ReactNode;
  /** For a grid of pictures rather than a form: the column takes up to 1120px instead of 720. */
  @prop declare wide?: boolean;
  @prop declare children: ReactNode;

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
    if (!this.saving) this.onClose();
  }

  /** Keeps it drawn while it leaves — see OverlayPresence. */
  private presence = new OverlayPresence(() => this.forceUpdate());

  render(): ReactNode {
    const shown = Platform.isBrowser ? this.presence.state(this.isOpen) : null;
    if (!shown) return null;
    const focus = AdminClass.of('focus');
    const tabs = this.tabs ?? [];
    // Through a portal, onto `body`: a fixed overlay drawn inside a card obeys the card's stacking
    // context, not the page, and the navigation then draws over it.
    return this.portal(
      <div className={focus} data-state={shown} aria-hidden={shown === 'closed' || undefined} role={shown === 'open' ? 'dialog' : undefined} aria-modal="true" aria-label={this.label}>
        <div className={`${focus}__backdrop`} onClick={this.close} />
        <div className={`${focus}__panel`}>
          <div className={`${focus}__head`}>
            <div className={`${focus}__head-start`}>
              <button type="button" className={`${focus}__esc`} onClick={this.close}>
                <Kbd>{AdminI18n.t('common.escKey')}</Kbd>
              </button>
              {tabs.length ? (
                <div className={`${focus}__tabs`} role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={tab.id === this.activeTab}
                      className={`fc-tab${tab.id === this.activeTab ? ' fc-tab--on' : ''}`}
                      onClick={() => this.onTab?.(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className={`${focus}__body`}>
            <div className={`${focus}__scroll`}>
              <div className={`${focus}__form${this.wide ? ` ${focus}__form--wide` : ''}`}>{this.children}</div>
            </div>
          </div>
          <div className={`${focus}__foot`}>
            {this.footNote ? <span className={`${focus}__note`}>{this.footNote}</span> : null}
            <Button type="button" variant={ButtonVariant.OUTLINE} onClick={this.close} disabled={this.saving}>
              {this.cancelLabel ?? AdminI18n.t('common.cancel')}
            </Button>
            <Button type="button" variant={ButtonVariant.PRIMARY} onClick={this.onConfirm}
              disabled={this.confirmDisabled} isLoading={this.saving}>
              {this.confirmLabel ?? AdminI18n.t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
