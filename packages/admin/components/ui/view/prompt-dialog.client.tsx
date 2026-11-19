import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { PromptInputType } from '@/components/ui/enums/prompt-input-type.enum';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import {prop, state, ref, bound, Platform} from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Dialog } from '@/components/ui/view/dialog.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class PromptDialog extends AdminComponent {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare onConfirm: (value: string) => void;
  @prop declare title: string;
  @prop declare description?: string;
  @prop declare placeholder?: string;
  @prop declare defaultValue?: string;
  @prop declare confirmLabel?: string;
  @prop declare cancelLabel?: string;
  @prop declare isLoading?: boolean;
  @prop declare icon?: ReactNode;
  @prop declare inputType?: PromptInputType;

  @ref declare inputRef: Ref<Input>;

  @state value = this.defaultValue ?? '';

  private syncOpenState(): void {
    if (!Platform.isBrowser) return;
    if (this.isOpen) {
      document.body.style.overflow = 'hidden';
      this.value = this.defaultValue ?? '';
      setTimeout(() => this.inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = 'unset';
    }
  }

  componentDidMount(): void {
    this.syncOpenState();
  }

  componentDidUpdate(prevProps: Readonly<Record<string, unknown>>): void {
    if (prevProps.isOpen !== this.isOpen || prevProps.defaultValue !== this.defaultValue) {
      this.syncOpenState();
    }
  }

  componentWillUnmount(): void {
    if (Platform.isBrowser) document.body.style.overflow = 'unset';
  }

  @bound private handleSubmit(e?: FormEvent): void {
    e?.preventDefault();
    const trimmed = this.value.trim();
    if (trimmed) {
      this.onConfirm(trimmed);
    }
  }

  @bound private handleChange(e: ChangeEvent<HTMLInputElement>): void {
    this.value = e.target.value;
  }

  render(): ReactNode {
    const placeholder = this.placeholder ?? AdminI18n.t('ui.prompt.placeholder');
    const confirmLabel = this.confirmLabel ?? AdminI18n.t('common.confirm');
    const cancelLabel = this.cancelLabel ?? AdminI18n.t('common.cancel');
    const isLoading = this.isLoading ?? false;
    // RESOLVED, never read straight off the prop. Callers pass the raw literal (`inputType="password"`),
    // and a string has no `.value` — so `type={inputType.value}` was `undefined`, React omitted the
    // attribute entirely, and the input fell back to `text`. The read-only override dialog asked for
    // the operator's account password and showed every character of it on screen.
    const inputType = PromptInputType.resolve(this.inputType ?? PromptInputType.TEXT);
    const { onClose, title, description } = this;
    const value = this.value;

    return (
      <Dialog
        isOpen={this.isOpen}
        onClose={onClose}
        title={title}
        description={description}
        busy={isLoading}
        foot={(
          <>
            <Button variant={ButtonVariant.SECONDARY} onClick={onClose} type="button" disabled={isLoading}>{cancelLabel}</Button>
            <Button variant={ButtonVariant.PRIMARY} onClick={this.handleSubmit} isLoading={isLoading} disabled={!value.trim()}>{confirmLabel}</Button>
          </>
        )}
      >
        {/* The answer is typed in the dialog's body; Enter sends it, like the button. */}
        <form onSubmit={this.handleSubmit}>
          <Input
            ref={this.inputRef}
            type={inputType.value}
            placeholder={placeholder}
            value={value}
            onChange={this.handleChange}
            disabled={isLoading}
            className="w-full"
            autoFocus
          />
        </form>
      </Dialog>
    );
  }
}
