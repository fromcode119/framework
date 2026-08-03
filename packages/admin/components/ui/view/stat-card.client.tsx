import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AdminClass } from '@/lib/admin-class';

export class StatCard extends PureReactor {
  @prop declare title: string;
  @prop declare value: string;
  @prop declare icon: ReactNode;
  @prop declare trend?: {
    value: number;
    isPositive: boolean;
  };

  render(): ReactNode {
    const { title, value, icon, trend } = this;
  return (
    <div className={`p-4 ${AdminClass.SURFACE} transition-colors`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400 [&_svg]:h-[18px] [&_svg]:w-[18px]">
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}%
          </div>
        )}
      </div>
      <p className="text-[11px] font-semibold text-slate-500 tracking-wide">{title}</p>
      <h3 className="text-xl font-bold mt-0.5 text-slate-900 dark:text-white tracking-tight">{value}</h3>
    </div>
  );
  }
}
