import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import {PureReactor, prop, Platform} from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class ConfirmDialog extends PureReactor {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare onConfirm: () => void;
  @prop declare title: string;
  @prop declare description: string;
  @prop declare confirmLabel?: string;
  @prop declare cancelLabel?: string;
  @prop declare variant?: ButtonVariant;
  @prop declare isLoading?: boolean;

  private applyBodyOverflow(): void {
    if (!Platform.isBrowser) return;
    document.body.style.overflow = this.isOpen ? 'hidden' : 'unset';
  }

  componentDidMount(): void {
    this.applyBodyOverflow();
  }

  componentDidUpdate(prevProps: { isOpen: boolean }): void {
    if (prevProps.isOpen !== this.isOpen) this.applyBodyOverflow();
  }

  componentWillUnmount(): void {
    if (Platform.isBrowser) document.body.style.overflow = 'unset';
  }

  render(): ReactNode {
    const confirmLabel = this.confirmLabel ?? AdminI18n.t('common.confirm');
    const cancelLabel = this.cancelLabel ?? AdminI18n.t('common.cancel');
    // A caller (or a plugin bundle) may pass the plain string; compared against the member, 'danger' never
    // matched and every delete confirmation came up as an ordinary primary action.
    const variant = ButtonVariant.resolve(this.variant ?? ButtonVariant.DANGER);
    const isLoading = this.isLoading ?? false;

    if (!this.isOpen) return null;

    return (
    <RootFramework>
      <div className="fc-confirm">
        <div className="fc-confirm__backdrop" onClick={this.onClose} />
        <div className="fc-confirm__panel">
          <div className="fc-confirm__top">
            <span className={`fc-confirm__mark${variant === ButtonVariant.DANGER ? ' fc-confirm__mark--danger' : ''}`}>
              <FrameworkIcons.Warning size={18} />
            </span>
            <div className="fc-confirm__text">
              <h3 className="fc-confirm__title">{this.title}</h3>
              <p className="fc-confirm__body">{this.description}</p>
            </div>
          </div>

          <div className="fc-confirm__foot">
            <Button variant={ButtonVariant.GHOST} onClick={this.onClose} disabled={isLoading}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === ButtonVariant.DANGER ? ButtonVariant.DANGER : ButtonVariant.PRIMARY}
              onClick={this.onConfirm}
              isLoading={isLoading}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </RootFramework>
    );
  }
}
