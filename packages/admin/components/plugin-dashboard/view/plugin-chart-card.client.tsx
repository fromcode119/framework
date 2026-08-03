import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AdminClass } from '@/lib/admin-class';

export class PluginChartCard extends PureReactor {
  @prop declare title: string;
  @prop declare subtitle?: string;
  @prop declare actions?: ReactNode;
  @prop declare children: ReactNode;
  @prop declare className?: string;
  @prop declare noPadding?: boolean;

  render(): ReactNode {
    const title = this.title;
    const subtitle = this.subtitle;
    const actions = this.actions;
    const children = this.children;
    const className = this.className ?? "";
    const noPadding = this.noPadding ?? false;
  return (
    <div
      className={`${AdminClass.SURFACE} transition-colors ${noPadding ? '' : 'p-4'} ${className}`}
    >
      {/* Header */}
      <div className={`flex items-start justify-between ${noPadding ? 'px-4 pt-4 pb-3' : 'mb-3'}`}>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={noPadding ? 'px-4 pb-4' : ''}>
        {children}
      </div>
    </div>
  );
  }
}
