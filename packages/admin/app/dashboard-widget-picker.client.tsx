import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IDashboardWidgetDefinition } from '@/lib/dashboard/interfaces/dashboard-widget-definition.interface';

/** Customize mode's shelf: every widget offered that is not on this dashboard, each one click to add. */
export class DashboardWidgetPicker extends PureReactor {
  @prop declare available: IDashboardWidgetDefinition[];
  @prop declare onAdd: (definition: IDashboardWidgetDefinition) => void;

  render(): ReactNode {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">{AdminI18n.t('dashboard.widgets.addTitle')}</h2>
        {this.available.length === 0 ? (
          <p className="mt-1 text-[12px] text-slate-500">{AdminI18n.t('dashboard.widgets.allAdded')}</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {this.available.map((definition) => (
              <li key={definition.key}>
                <button
                  type="button"
                  onClick={() => this.onAdd(definition)}
                  className="flex h-full w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <FrameworkIcons.Plus size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">{definition.label}</span>
                    {definition.source ? <span className="block text-[11px] text-slate-400">{definition.source}</span> : null}
                    {definition.description ? <span className="mt-1 block text-[12px] text-slate-500">{definition.description}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }
}
