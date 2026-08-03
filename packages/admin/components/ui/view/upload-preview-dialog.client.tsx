import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@fromcode119/react';
import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';
import { AdminClass } from '@/lib/admin-class';
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
    const { title, description, sections, onClose, onConfirm } = this;
    const confirmLabel = this.confirmLabel ?? 'Install';
    const cancelLabel = this.cancelLabel ?? 'Cancel';
    const isLoading = this.isLoading ?? false;

    if (!this.isOpen) return null;

    return (
    <RootFramework>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={onClose}
        />

        <div className={`relative w-full max-w-2xl my-auto ${AdminClass.SURFACE} p-5 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300`}>
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg flex-shrink-0 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <FrameworkIcons.Warning size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h3>
              {description ? (
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg transition-colors hover:bg-slate-50 text-slate-400 hover:text-slate-900 dark:hover:bg-slate-800 dark:text-slate-500 dark:hover:text-white"
            >
              <FrameworkIcons.Close size={20} />
            </button>
          </div>

          <div className="mt-6 space-y-4 max-h-[45vh] overflow-auto pr-1">
            {sections.map((section) => (
              <div
                key={section.title}
                className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {section.title}
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {section.items.length === 0 ? (
                    <li className="text-sm text-slate-500 dark:text-slate-400">None</li>
                  ) : (
                    section.items.map((item, index) => (
                      <li key={`${section.title}-${index}`} className="text-sm text-slate-700 dark:text-slate-200">
                        {item}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button
              variant={ButtonVariant.GHOST}
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={ButtonVariant.PRIMARY}
              className="flex-1"
              onClick={onConfirm}
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
