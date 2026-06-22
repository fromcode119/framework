"use client";

import React from 'react';

interface StatItem {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  href?: string;
}

interface PluginStatsListProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const colorClasses = {
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

const gridCols: Record<number, string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
};

function StatCard({ stat }: { stat: StatItem }) {
  const colors = colorClasses[stat.color || 'primary'];
  
  const cardClass = `
    group relative overflow-hidden
    rounded-xl
    bg-white dark:bg-slate-900/60
    p-4
    transition-colors duration-150
    ring-1 ring-black/5 dark:ring-white/5
    ${stat.href ? 'block no-underline cursor-pointer hover:ring-indigo-500/30' : ''}
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

export class PluginStatsList extends React.Component<PluginStatsListProps> {
  render(): React.ReactNode {
    const {
  stats,
  columns = 3,
  className = '',
} = this.props;
  return (
    <div className={`grid ${gridCols[columns] || gridCols[4]} gap-3 ${className}`}>
      {stats.map((stat, index) => (
        <StatCard key={index} stat={stat} />
      ))}
    </div>
  );
  }
}
