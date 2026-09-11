import type { ReactNode } from 'react';
import { prop, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminPathUtils } from '@/lib/admin-path';
import { FrameworkIcons } from '@fromcode119/react';
import { DashboardSectionHeading } from '@/app/dashboard-section-heading';

/**
 * The things that are not configured and will silently not work — email being the sharp one, since
 * a platform that cannot send mail fails at the first password reset.
 *
 * Configured items stay on the list rather than disappearing: "email delivery: configured · smtp" is
 * the answer to the same question, and a list that only shows problems cannot be used to check.
 */
export class DashboardMissingConfig extends AdminComponent {
  @prop declare items: Array<Record<string, any>>;

  @bound
  private go(path: string): void {
    if (path) this.router.push(AdminPathUtils.toAdminPath(path));
  }

  /**
   * Rules BETWEEN cells only, and the grid is one column below `sm` and two above it — so the second
   * item starts a new row on a phone and shares the first row on a desktop, and its top rule has to
   * disappear at exactly that breakpoint. Written out as literal classes because Tailwind only emits
   * what it can read in the source.
   */
  private static cellClass(index: number): string {
    return [
      'px-3 py-2 border-slate-200/70 dark:border-slate-800/70',
      index > 0 ? 'border-t' : '',
      index === 1 ? 'sm:border-t-0' : '',
      index % 2 === 0 ? 'sm:border-r' : '',
    ].filter((part) => part !== '').join(' ');
  }

  private get outstanding(): number {
    return this.items.filter((item) => !item.done).length;
  }

  render(): ReactNode {
    if (this.items.length === 0) return null;

    return (
      <div className="space-y-2">
        <DashboardSectionHeading
          label="Configuration"
          count={this.outstanding > 0 ? `${this.outstanding} to do` : 'all set'}
        />
        {/*
          * Two columns from `sm` up. As one full-width list each row stretched the whole dashboard,
          * which put "Configure" some 1300px from the words "Email delivery" — far enough apart that
          * the pair stopped reading as one row and the button stopped looking like it belonged to
          * anything. Paired columns keep a label and its action within a glance of each other.
          */}
        <div className={`${AdminClass.SURFACE} grid overflow-hidden sm:grid-cols-2`}>
          {this.items.map((item, index) => (
            <button
              key={String(item.key)}
              type="button"
              onClick={() => this.go(String(item.actionPath))}
              className={DashboardMissingConfig.cellClass(index)}
            >
              {/*
                * The ROW is the control, not a pill sitting inside it. Each row had a bordered
                * button, and four of them stacked read as a form of small grey boxes rather than as
                * a list — the action word and a chevron say the same thing without the furniture.
                */}
              <span className="flex w-full max-w-lg items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate text-[12.5px] font-medium leading-tight text-slate-800 dark:text-slate-100">
                    {String(item.title)}
                  </span>
                  <span
                    className={`truncate text-[11px] leading-tight ${
                      item.done ? 'text-slate-500 dark:text-slate-400' : 'text-amber-600 dark:text-amber-500'
                    }`}
                  >
                    {String(item.detail)}
                  </span>
                </span>
                {item.actionLabel ? (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-400 transition-colors group-hover/row:text-indigo-600 dark:group-hover/row:text-indigo-400">
                    {String(item.actionLabel)}
                    <FrameworkIcons.ChevronRight size={13} />
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
}
