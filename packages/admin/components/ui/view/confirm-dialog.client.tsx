import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { Dialog } from '@/components/ui/view/dialog.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A question with two answers, asked before something that cannot be taken back.
 *
 * It is the console's one dialog ({@link Dialog}): 400 wide, the question, one line under it, the
 * answers at the end. It used to draw a panel of its own with a warning mark beside the title — a
 * second dialog beside the first, and a mark the reference's question never carries.
 */
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

  render(): ReactNode {
    const confirmLabel = this.confirmLabel ?? AdminI18n.t('common.confirm');
    const cancelLabel = this.cancelLabel ?? AdminI18n.t('common.cancel');
    // A caller (or a plugin bundle) may pass the plain string; compared against the member, 'danger' never
    // matched and every delete confirmation came up as an ordinary primary action.
    const variant = ButtonVariant.resolve(this.variant ?? ButtonVariant.DANGER);
    const isLoading = this.isLoading ?? false;
    return (
      <Dialog
        isOpen={this.isOpen}
        onClose={this.onClose}
        title={this.title}
        description={this.description}
        busy={isLoading}
        foot={(
          <>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.onClose} disabled={isLoading}>{cancelLabel}</Button>
            <Button variant={variant === ButtonVariant.DANGER ? ButtonVariant.DANGER : ButtonVariant.PRIMARY} onClick={this.onConfirm} isLoading={isLoading}>
              {confirmLabel}
            </Button>
          </>
        )}
      />
    );
  }
}
