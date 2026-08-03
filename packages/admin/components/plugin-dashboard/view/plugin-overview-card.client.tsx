import type { IPluginOverviewCardTrend } from '@/components/plugin-dashboard/interfaces/plugin-overview-card-trend.interface';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AdminClass } from '@/lib/admin-class';

export class PluginOverviewCard extends PureReactor {
  @prop declare title: string;
  @prop declare value: string | number;
  @prop declare icon?: ReactNode;
  @prop declare trend?: IPluginOverviewCardTrend;
  @prop declare subtitle?: string;
  @prop declare onClick?: () => void;
  @prop declare className?: string;

  render(): ReactNode {
    const title = this.title;
    const value = this.value;
    const icon = this.icon;
    const trend = this.trend;
    const subtitle = this.subtitle;
    const onClick = this.onClick;
    const className = this.className ?? "";
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden ${AdminClass.SURFACE} p-4 transition-colors ${isClickable ? 'cursor-pointer hover:border-indigo-400/40' : ''} ${className}`}
    >
      <div className="relative">
        {/* Header with Icon */}
        <div className="flex items-start justify-between mb-3">
          {icon && (
            <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 [&_svg]:h-[18px] [&_svg]:w-[18px]">
              {icon}
            </div>
          )}
          {trend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
              trend.isPositive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}>
              <span className="leading-none">{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        {/* Title */}
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-[0.1em] uppercase mb-1">
          {title}
        </p>

        {/* Value */}
        <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
          {value}
        </h3>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
            {subtitle}
          </p>
        )}

        {/* Trend Label */}
        {trend?.label && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 uppercase tracking-wide">
            {trend.label}
          </p>
        )}
      </div>
    </div>
  );
  }
}
