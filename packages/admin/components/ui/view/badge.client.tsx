import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

export class Badge extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare variant?: BadgeVariant;
  @prop declare className?: string;

  render(): ReactNode {
    const variant = this.variant ?? BadgeVariant.DEFAULT;
    const className = this.className ?? '';
  const variants: Record<string, any> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
    blue: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
    gray: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
    default: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border ${variants[BadgeVariant.resolve(variant).value]} ${className}`}>
      {this.children}
    </span>
  );
  }
}
