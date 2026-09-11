import type { ReactNode } from 'react';
import { prop, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminPathUtils } from '@/lib/admin-path';

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

  private get outstanding(): number {
    return this.items.filter((item) => !item.done).length;
  }

  render(): ReactNode {
    if (this.items.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-4 w-1 rounded-full bg-indigo-600 dark:bg-indigo-500/40" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Configuration</span>
          <div className="h-px flex-1 bg-slate-200/60 dark:bg-slate-800" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {this.outstanding} outstanding
          </span>
        </div>
        <div className={`${AdminClass.SURFACE} divide-y divide-slate-200/70 dark:divide-slate-800/70`}>
          {this.items.map((item) => (
            <div key={String(item.key)} className="flex items-center gap-2.5 px-3 py-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="shrink-0 text-[12px] text-slate-700 dark:text-slate-200">{String(item.title)}</span>
              <span className="min-w-0 flex-1 truncate text-right text-[11px] text-slate-500">{String(item.detail)}</span>
              {!item.done && item.actionLabel ? (
                <button
                  type="button"
                  onClick={() => this.go(String(item.actionPath))}
                  className="shrink-0 text-[11px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  {String(item.actionLabel)}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }
}
