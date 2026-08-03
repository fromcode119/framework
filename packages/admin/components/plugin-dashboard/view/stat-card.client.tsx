import type { IStatItem } from '@/components/plugin-dashboard/interfaces/stat-item.interface';
import { StatColor } from '@/components/plugin-dashboard/enums/stat-color.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AdminClass } from '@/lib/admin-class';

export class StatCard extends PureReactor {
  /** Tailwind class sets per stat colour. Belongs to the component that renders them. */
  private static readonly COLOR_CLASSES: Record<string, any> = {
    primary: {
      bg: 'bg-indigo-500/10 dark:bg-indigo-400/10',
      text: 'text-indigo-600 dark:text-indigo-400',
      ring: 'ring-1 ring-indigo-500/20 dark:ring-indigo-400/20',
      hover: 'hover:bg-indigo-500/15 dark:hover:bg-indigo-400/15',
    },
    success: {
      bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      ring: 'ring-1 ring-emerald-500/20 dark:ring-emerald-400/20',
      hover: 'hover:bg-emerald-500/15 dark:hover:bg-emerald-400/15',
    },
    warning: {
      bg: 'bg-amber-500/10 dark:bg-amber-400/10',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-1 ring-amber-500/20 dark:ring-amber-400/20',
      hover: 'hover:bg-amber-500/15 dark:hover:bg-amber-400/15',
    },
    danger: {
      bg: 'bg-rose-500/10 dark:bg-rose-400/10',
      text: 'text-rose-600 dark:text-rose-400',
      ring: 'ring-1 ring-rose-500/20 dark:ring-rose-400/20',
      hover: 'hover:bg-rose-500/15 dark:hover:bg-rose-400/15',
    },
    info: {
      bg: 'bg-sky-500/10 dark:bg-sky-400/10',
      text: 'text-sky-600 dark:text-sky-400',
      ring: 'ring-1 ring-sky-500/20 dark:ring-sky-400/20',
      hover: 'hover:bg-sky-500/15 dark:hover:bg-sky-400/15',
    },
  };

  @prop declare stat: IStatItem;

  render(): ReactNode {
    const stat = this.stat;
    const colors = StatCard.COLOR_CLASSES[StatColor.resolve(stat.color).value];

    // AdminClass.SURFACE IS the raised-panel treatment (radius + border + card background + shadow).
    // These tiles previously drew their own `rounded-xl … ring-1`, which is why they alone had no shadow.
    const cardClass = `
    group relative overflow-hidden
    ${AdminClass.SURFACE}
    p-4
    transition-colors duration-150
    ${stat.href ? 'block no-underline cursor-pointer hover:border-indigo-500/30' : ''}
  `;

    const inner = (
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          {stat.icon && (
            <div className={`h-9 w-9 flex items-center justify-center rounded-lg ${colors.bg} ${colors.text} [&_svg]:h-[18px] [&_svg]:w-[18px]`}>
              {stat.icon}
            </div>
          )}
          {stat.trend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
              stat.trend.isPositive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}>
              <span className="leading-none">{stat.trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(stat.trend.value)}%</span>
            </div>
          )}
        </div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-[0.1em] uppercase mb-1">
          {stat.label}
        </p>
        <h4 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
          {stat.value}
        </h4>
        {stat.subtext && (
          <p className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/50 text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed tracking-tight">
            {stat.subtext}
          </p>
        )}
      </div>
    );

    if (stat.href) {
      return <a href={stat.href} className={cardClass}>{inner}</a>;
    }
    return <div className={cardClass}>{inner}</div>;
  }
}
