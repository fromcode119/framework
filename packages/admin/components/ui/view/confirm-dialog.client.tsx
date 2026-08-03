import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';
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
    if (typeof document === 'undefined') return;
    document.body.style.overflow = this.isOpen ? 'hidden' : 'unset';
  }

  componentDidMount(): void {
    this.applyBodyOverflow();
  }

  componentDidUpdate(prevProps: { isOpen: boolean }): void {
    if (prevProps.isOpen !== this.isOpen) this.applyBodyOverflow();
  }

  componentWillUnmount(): void {
    if (typeof document !== 'undefined') document.body.style.overflow = 'unset';
  }

  render(): ReactNode {
    const confirmLabel = this.confirmLabel ?? 'Confirm';
    const cancelLabel = this.cancelLabel ?? 'Cancel';
    const variant = this.variant ?? 'danger';
    const isLoading = this.isLoading ?? false;

    if (!this.isOpen) return null;

    return (
    <RootFramework>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={this.onClose}
        />

        {/* Dialog */}
        <div className={`relative w-full max-w-md my-auto ${AdminClass.SURFACE} p-5 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300`}>
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${
              variant === ButtonVariant.DANGER
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500'
                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-500'
            }`}>
              <FrameworkIcons.Warning size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {this.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {this.description}
              </p>
            </div>
            <button
              onClick={this.onClose}
              className="p-1 rounded-lg transition-colors hover:bg-slate-50 text-slate-400 hover:text-slate-900 dark:hover:bg-slate-800 dark:text-slate-500 dark:hover:text-white"
            >
              <FrameworkIcons.Close size={20} />
            </button>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <Button
              variant={ButtonVariant.GHOST}
              className="flex-1"
              onClick={this.onClose}
              disabled={isLoading}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={variant === ButtonVariant.DANGER ? ButtonVariant.DANGER : ButtonVariant.PRIMARY}
              className="flex-1"
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
