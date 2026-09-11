import type { ReactNode } from 'react';
import { prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminPathUtils } from '@/lib/admin-path';
import { DashboardSectionHeading } from '@/app/dashboard-section-heading';

/**
 * The things that are not configured and will silently not work — email being the sharp one, since
 * a platform that cannot send mail fails at the first password reset.
 *
 * Configured items stay on the list rather than disappearing: "Timezone · Europe/Madrid" answers the
 * same question, and a list that only shows problems cannot be used to check.
 *
 * One row per item, one LINE per row, exactly like the sites list above it. Two columns put a
 * two-line row beside a one-line row so nothing lined up across the gap, and stacking the state
 * under the title made some rows look like headings and others like values. Same shape every row,
 * and the eye can run down the column.
 */
export class DashboardMissingConfig extends AdminComponent {
  @prop declare items: Array<Record<string, any>>;

  @bound
  private go(path: string): void {
    if (path) this.router.push(AdminPathUtils.toAdminPath(path));
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
        <div className={`${AdminClass.SURFACE} divide-y divide-slate-200/70 dark:divide-slate-800/70`}>
          {this.items.map((item) => (
            <button
              key={String(item.key)}
              type="button"
              onClick={() => this.go(String(item.actionPath))}
              className="group/row flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="shrink-0 text-[12px] text-slate-700 dark:text-slate-200">{String(item.title)}</span>
              <span
                className={`min-w-0 flex-1 truncate text-right text-[11px] ${
                  item.done ? 'text-slate-500' : 'text-amber-600 dark:text-amber-500'
                }`}
              >
                {String(item.detail)}
              </span>
              {item.actionLabel ? (
                <span className="flex w-20 shrink-0 items-center justify-end gap-1 text-[11px] font-medium text-slate-400 transition-colors group-hover/row:text-indigo-600 dark:group-hover/row:text-indigo-400">
                  {String(item.actionLabel)}
                  <FrameworkIcons.ChevronRight size={13} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    );
  }
}
