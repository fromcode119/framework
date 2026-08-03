import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';

import { Icon } from '@/components/view/icon.client';
import type { IDashboardQuickAction } from '@/app/interfaces/dashboard-quick-action.interface';
import { AdminClass } from '@/lib/admin-class';
/** A compact row of one-click shortcuts to the most common admin tasks. */
export class DashboardQuickActions extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<DashboardQuickActions, 'actions' | 'onNavigate'>;

  @prop declare actions: IDashboardQuickAction[];
  @prop declare onNavigate: (href: string) => void;

  render(): ReactNode {
    const { actions, onNavigate } = this;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {actions.map((a) => (
          <button
            key={a.href}
            type="button"
            onClick={() => onNavigate(a.href)}
            className={`group flex items-center gap-2.5 ${AdminClass.SURFACE} px-3 py-2.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/5`}
          >
            <span className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors dark:bg-indigo-500/10 dark:text-indigo-400 [&_svg]:h-4 [&_svg]:w-4">
              <Icon name={a.icon} size={16} />
            </span>
            <span className="text-xs font-semibold tracking-tight text-slate-700 dark:text-slate-200 truncate">{a.label}</span>
          </button>
        ))}
      </div>
    );
  }
}
