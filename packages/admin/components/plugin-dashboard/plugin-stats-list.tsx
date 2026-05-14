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
  columns?: 2 | 3 | 4;
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

const gridCols = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

function StatCard({ stat }: { stat: StatItem }) {
  const colors = colorClasses[stat.color || 'primary'];
  
  const cardClass = `
    group relative overflow-hidden
    rounded-2xl
    bg-white/98 dark:bg-slate-900/98
    backdrop-blur-xl
    p-6
    transition-all duration-150
    hover:shadow-2xl hover:shadow-slate-950/10 dark:hover:shadow-black/40
    hover:-translate-y-0.5
    ring-1 ring-black/5 dark:ring-white/5
    ${stat.href ? 'block no-underline cursor-pointer active:scale-[0.98]' : ''}
  `;

  const inner = (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50/80 to-transparent dark:from-slate-800/40 dark:to-transparent opacity-50" />
      <div className="relative">
        <div className="flex items-center justify-between mb-5">
          {stat.icon && (
            <div className={`
              p-3.5 rounded-xl
              ${colors.bg} ${colors.text} ${colors.ring}
              transition-all duration-150
              ${stat.href ? `group-hover:scale-110 ${colors.hover}` : ''}
              shadow-sm
            `}>
              {stat.icon}
            </div>
          )}
          {stat.trend && (
            <div className={`
              flex items-center gap-1.5 
              px-3 py-1.5 
              rounded-xl 
              text-[10px] font-bold uppercase tracking-wider
              transition-all duration-150
              ${stat.trend.isPositive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20 dark:ring-emerald-400/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20 dark:ring-rose-400/20'
              }
            `}>
              <span className="text-sm leading-none">{stat.trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(stat.trend.value)}%</span>
            </div>
          )}
        </div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-[0.12em] uppercase mb-2.5">
          {stat.label}
        </p>
        <h4 className="text-[32px] font-bold text-slate-900 dark:text-white tracking-tight leading-none">
          {stat.value}
        </h4>
        {stat.subtext && (
          <p className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50 text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed tracking-tight">
            {stat.subtext}
          </p>
        )}
      </div>
    </>
  );

  if (stat.href) {
    return <a href={stat.href} className={cardClass}>{inner}</a>;
  }
  return <div className={cardClass}>{inner}</div>;
}

export const PluginStatsList = ({
  stats,
  columns = 3,
  className = '',
}: PluginStatsListProps) => {
  return (
    <div className={`grid ${gridCols[columns]} gap-6 ${className}`}>
      {stats.map((stat, index) => (
        <StatCard key={index} stat={stat} />
      ))}
    </div>
  );
};
