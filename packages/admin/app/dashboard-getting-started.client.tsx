import type { ReactNode } from 'react';
import { prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminPathUtils } from '@/lib/admin-path';

/**
 * The first screen of an installation nobody has started using yet.
 *
 * Not a grid of zeros: a fresh install has nothing to count, and a stat card reading 0 next to a
 * 14-day chart of one event tells an operator nothing they can act on. Three steps, each with the
 * reason it matters, and the first undone one carries the primary button.
 */
export class DashboardGettingStarted extends AdminComponent {
  @prop declare steps: Array<Record<string, any>>;

  @bound
  private go(path: string): void {
    if (path) this.router.push(AdminPathUtils.toAdminPath(path));
  }

  private get firstUndoneKey(): string {
    return String(this.steps.find((step) => !step.done)?.key ?? '');
  }

  private marker(step: Record<string, any>, position: number): ReactNode {
    if (step.done) {
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <FrameworkIcons.Check size={13} />
        </span>
      );
    }
    const isNext = String(step.key) === this.firstUndoneKey;
    return (
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
          isNext ? 'border-indigo-500 text-indigo-500' : 'border-slate-300 text-slate-400 dark:border-slate-700'
        }`}
      >
        {position}
      </span>
    );
  }

  render(): ReactNode {
    return (
      <div className={`${AdminClass.SURFACE} p-5`}>
        <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
          Finish setting up your platform
        </h2>
        <p className="mt-1 mb-4 max-w-xl text-[12px] leading-relaxed text-slate-500">
          Three things stand between this installation and a site people can visit. Not in order — this is
          simply what is missing.
        </p>

        <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
          {this.steps.map((step, position) => (
            <div key={String(step.key)} className="flex items-center gap-3 py-3">
              {this.marker(step, position + 1)}
              <div className="min-w-0 flex-1">
                <div className={`text-[13px] font-semibold ${step.done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                  {String(step.title)}
                </div>
                {!step.done ? (
                  <div className="text-[11px] leading-relaxed text-slate-500">{String(step.detail)}</div>
                ) : null}
              </div>
              {!step.done ? (
                <button
                  type="button"
                  onClick={() => this.go(String(step.actionPath))}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                    String(step.key) === this.firstUndoneKey
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                      : 'border border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  {String(step.actionLabel)}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }
}
