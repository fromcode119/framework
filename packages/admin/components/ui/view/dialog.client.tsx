import type { ReactNode } from 'react';
import { PureReactor, prop, bound, Platform } from '@fromcode119/react-class-components';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { DialogSize } from '@/components/ui/enums/dialog-size.enum';
import { DialogTone } from '@/components/ui/enums/dialog-tone.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * ONE centred dialog: a scrim, a panel, a head and a foot.
 *
 * Everything that asks a short question or shows a short thing over the page is this — the delete
 * confirmation, the dependency warning, "move to", the upload preview, a revision. Each of them used
 * to draw its own: four copies of `fixed inset-0 bg-slate-950/60 backdrop-blur-md`, panels at p-5,
 * p-6 and p-8, widths md/lg/2xl, close buttons in three different greys, icon tiles hardcoded rose,
 * amber and indigo — and one of them at `z-[1000]` while the others sat at `z-[500]`, so two open
 * dialogs stacked in the wrong order.
 *
 * The caller says what it is about (title, tone, size) and what goes in the body and the foot. It
 * never says how the dialog looks: that is `admin.css` (`.fc-dialog__*`).
 *
 * `Escape` closes it, the scrim closes it, and while it is open the page behind does not scroll.
 */
export class Dialog extends PureReactor {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  /** Drawn as the dialog's heading and used as its accessible name. */
  @prop declare title: string;
  /** One line under the title. */
  @prop declare description?: ReactNode;
  /** The mark beside the title; without one the head is the title alone. */
  @prop declare icon?: ReactNode;
  @prop declare tone?: DialogTone;
  @prop declare size?: DialogSize;
  /** The buttons. They sit at the end of the foot, and on a phone they stack and fill the width. */
  @prop declare foot?: ReactNode;
  /** Keeps the dialog open while something is in flight: Escape and the scrim stop closing it. */
  @prop declare busy?: boolean;
  /** Hides the ✕. For a dialog that must be answered by its buttons. */
  @prop declare noClose?: boolean;
  @prop declare children?: ReactNode;

  componentDidMount(): void {
    if (!Platform.isBrowser) return;
    document.addEventListener('keydown', this.onKeyDown);
    this.applyBodyOverflow();
  }

  componentDidUpdate(previous: { isOpen: boolean }): void {
    if (previous.isOpen !== this.isOpen) this.applyBodyOverflow();
  }

  componentWillUnmount(): void {
    if (!Platform.isBrowser) return;
    document.removeEventListener('keydown', this.onKeyDown);
    document.body.style.overflow = 'unset';
  }

  /** The page behind a dialog does not scroll: a wheel over the scrim moved the record underneath. */
  private applyBodyOverflow(): void {
    if (!Platform.isBrowser) return;
    document.body.style.overflow = this.isOpen ? 'hidden' : 'unset';
  }

  @bound private onKeyDown(event: KeyboardEvent): void {
    if (this.isOpen && event.key === 'Escape') this.close();
  }

  @bound private close(): void {
    if (!this.busy) this.onClose();
  }

  render(): ReactNode {
    if (!this.isOpen || !Platform.isBrowser) return null;
    const size = DialogSize.resolve(this.size ?? DialogSize.MEDIUM);
    const tone = DialogTone.resolve(this.tone ?? DialogTone.NEUTRAL);
    return (
      <RootFramework>
        <div className="fc-dialog" role="dialog" aria-modal="true" aria-label={this.title}>
          <div className="fc-dialog__backdrop" onClick={this.close} />
          <div className={`fc-dialog__panel fc-dialog__panel--${size}`}>
            <div className="fc-dialog__head">
              {this.icon ? <span className={`fc-dialog__mark fc-dialog__mark--${tone}`}>{this.icon}</span> : null}
              <div className="fc-dialog__text">
                <h3 className="fc-dialog__title">{this.title}</h3>
                {this.description ? <p className="fc-dialog__description">{this.description}</p> : null}
              </div>
              {this.noClose ? null : (
                <button
                  type="button"
                  className="fc-dialog__close"
                  onClick={this.close}
                  disabled={this.busy}
                  aria-label={AdminI18n.t('common.close')}
                >
                  <FrameworkIcons.Close size={16} />
                </button>
              )}
            </div>
            {this.children ? <div className="fc-dialog__body">{this.children}</div> : null}
            {this.foot ? <div className="fc-dialog__foot">{this.foot}</div> : null}
          </div>
        </div>
      </RootFramework>
    );
  }
}
