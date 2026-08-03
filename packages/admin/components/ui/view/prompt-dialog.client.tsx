import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { PromptInputType } from '@/components/ui/enums/prompt-input-type.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { prop, state, ref, bound } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@fromcode119/react';
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
    if (typeof document === 'undefined') return;
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
    if (typeof document !== 'undefined') document.body.style.overflow = 'unset';
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
    const placeholder = this.placeholder ?? 'Enter value...';
    const confirmLabel = this.confirmLabel ?? 'Confirm';
    const cancelLabel = this.cancelLabel ?? 'Cancel';
    const isLoading = this.isLoading ?? false;
    const inputType = this.inputType ?? PromptInputType.TEXT;
    const { onClose, title, description, icon } = this;
    const theme = this.theme;
    const value = this.value;

    if (!this.isOpen) return null;

    return (
    <RootFramework>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={onClose}
        />

        {/* Dialog */}
        <div className={`relative w-full max-w-md my-auto rounded-xl border shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 ${
          theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200/50'
        }`}>
        <div className="flex items-start gap-4 mb-6">
          {icon && (
            <div className={`p-3 rounded-xl flex-shrink-0 ${
              theme === ThemeMode.DARK ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'
            }`}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h3>
            {description && (
              <p className={`mt-1 text-sm leading-relaxed ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors ${theme === ThemeMode.DARK ? 'hover:bg-slate-800 text-slate-500 hover:text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
          >
            <FrameworkIcons.Close size={20} />
          </button>
        </div>

        <form onSubmit={this.handleSubmit} className="space-y-6">
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

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant={ButtonVariant.GHOST}
              className="flex-1"
              onClick={onClose}
              type="button"
              disabled={isLoading}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={ButtonVariant.PRIMARY}
              className="flex-1"
              type="submit"
              isLoading={isLoading}
              disabled={!value.trim()}
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
    </RootFramework>
    );
  }
}
