import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';

/**
 * The visible "this page never loaded" state.
 *
 * A settings screen that swallows its load failure renders whatever its fields were initialised with,
 * and the operator cannot tell an invented value from a saved one — then Save writes the invented value
 * over the real configuration. Every load that can fail renders this instead of a form, and the page's
 * Save control stays out of the DOM until a load has actually succeeded.
 */
export class LoadErrorPanel extends PureReactor {
  declare props: Pick<LoadErrorPanel, 'title' | 'message' | 'onRetry' | 'isRetrying'>;

  @prop declare title: string;
  @prop declare message: string;
  @prop declare onRetry?: () => void;
  @prop declare isRetrying?: boolean;

  render(): ReactNode {
    return (
      <div className={`${AdminClass.SURFACE} m-6 p-4 border-rose-500/40 bg-rose-500/5`}>
        <div className="flex items-start gap-3">
          <FrameworkIcons.Warning size={16} className="mt-0.5 shrink-0 text-rose-500" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-semibold tracking-tight text-rose-600 dark:text-rose-400">{this.title}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)] break-words">{this.message}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              Nothing on this screen reflects the stored configuration, so saving is disabled until the load succeeds.
            </p>
          </div>
          {this.onRetry && (
            <Button
              variant={ButtonVariant.SECONDARY}
              size={FieldSize.SM}
              icon={<FrameworkIcons.Refresh size={13} />}
              onClick={this.onRetry}
              isLoading={this.isRetrying}
            >
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }
}
