import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AdminClass } from '@/lib/admin-class';

export class SectionCard extends PureReactor {
  @prop declare title: string;
  @prop declare subtitle?: string;
  @prop declare icon?: ReactNode;
  @prop declare actions?: ReactNode;
  @prop declare children: ReactNode;
  @prop declare noPadding?: boolean;
  @prop declare className?: string;

  render(): ReactNode {
    const { title, subtitle, icon, actions, children } = this;
    const noPadding = this.noPadding ?? false;
    const className = this.className ?? '';
    return (
      <section className={`${AdminClass.SURFACE} overflow-hidden bg-white border-slate-200/70 shadow-sm dark:bg-slate-900/40 dark:border-slate-800 dark:shadow-none ${className}`}>
        <header className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold tracking-tight text-slate-800 dark:text-white truncate">{title}</h2>
              {subtitle && (
                <p className="text-[10px] font-semibold tracking-tight text-slate-400 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
        {noPadding ? children : <div className="p-4">{children}</div>}
      </section>
    );
  }
}
