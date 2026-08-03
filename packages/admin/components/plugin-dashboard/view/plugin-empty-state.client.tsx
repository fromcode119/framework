import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

export class PluginEmptyState extends PureReactor {
  @prop declare icon?: ReactNode;
  @prop declare title: string;
  @prop declare description?: string;
  @prop declare action?: {
    label: string;
    onClick: () => void;
  };
  @prop declare className?: string;

  render(): ReactNode {
    const icon = this.icon;
    const title = this.title;
    const description = this.description;
    const action = this.action;
    const className = this.className ?? "";
    return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/70 bg-slate-50/40 py-12 px-6 text-center dark:bg-slate-800/20 dark:border-slate-700/50 ${className}`}
    >
      {/* Icon */}
      {icon && (
        <div className="mb-3 h-12 w-12 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 tracking-tight mb-1">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-4 leading-relaxed">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
  }
}
