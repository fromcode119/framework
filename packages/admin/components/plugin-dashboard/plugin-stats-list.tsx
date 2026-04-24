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
  primary: 'from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400',
  success: 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400',
  danger: 'from-rose-500/10 to-red-500/10 text-rose-600 dark:text-rose-400',
  info: 'from-sky-500/10 to-cyan-500/10 text-sky-600 dark:text-sky-400',
};

const gridCols = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

function StatCard({ stat }: { stat: StatItem }) {
  const cardClass = `
    relative overflow-hidden
    rounded-[2rem] border-2 border-slate-200/80
    bg-white
    p-6
    transition-all duration-300
    hover:shadow-lg hover:scale-[1.02]
    dark:bg-slate-900/50
    dark:border-slate-700/50
    ${stat.href ? 'block no-underline cursor-pointer' : ''}
  `;

  const inner = (
    <>
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-slate-100/50 to-slate-200/30 rounded-full blur-2xl dark:from-slate-800/50 dark:to-slate-700/30" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          {stat.icon && (
            <div className={`p-3 rounded-[1.25rem] bg-gradient-to-br shadow-sm ${colorClasses[stat.color || 'primary']}`}>
              {stat.icon}
            </div>
          )}
          {stat.trend && (
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              stat.trend.isPositive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}>
              <span className="text-sm leading-none">{stat.trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(stat.trend.value)}%</span>
            </div>
          )}
        </div>
        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-2">
          {stat.label}
        </p>
        <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
          {stat.value}
        </h4>
        {stat.subtext && (
          <p className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-800/50 text-[11px] font-bold text-slate-500 leading-relaxed">
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
