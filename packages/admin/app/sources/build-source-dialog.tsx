import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/view/button.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { X } from 'lucide-react';
import type { IBuildSourceDialogProps } from '@/app/sources/interfaces/build-source-dialog-props.interface';

/** Modal shell for the build-source forms. Escape closes; the body is portalled to `document.body`. */
export class BuildSourceDialog extends AdminComponent {
  declare props: Pick<IBuildSourceDialogProps, keyof IBuildSourceDialogProps>;
  componentDidMount(): void {
    window.addEventListener('keydown', this.handleEscape);
  }

  componentWillUnmount(): void {
    window.removeEventListener('keydown', this.handleEscape);
  }

  private readonly handleEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.props.onClose();
  };

  render(): ReactNode {
    const { children, description, onClose, title } = this.props;
    const dialog = (
      <div className="fixed inset-0 z-[2147483000] flex items-center justify-center px-4 py-8">
        <button
          aria-label="Close build source dialog"
          className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
          onClick={onClose}
          type="button"
        />
        <div className="relative z-[81] w-full max-w-3xl">
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
              </div>
              <Button icon={<X size={14} />} onClick={onClose} variant={ButtonVariant.GHOST}>
                Close
              </Button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-6 py-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    );

    if (typeof document === 'undefined') return dialog;
    return this.portal(dialog);
  }
}
