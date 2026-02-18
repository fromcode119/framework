"use client";

import React from 'react';

interface PluginOverviewCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

export const PluginOverviewCard = ({ 
  title, 
  value, 
  icon, 
  trend, 
  subtitle, 
  onClick,
  className = "" 
}: PluginOverviewCardProps) => {
  const isClickable = !!onClick;
  
  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-hidden
        rounded-[2.5rem] border-2 border-slate-200/80 
        bg-gradient-to-br from-white to-slate-50/30 
        p-8 
        transition-all duration-300 
        dark:from-slate-900/50 dark:to-slate-800/30 
        dark:border-slate-700/50
        ${isClickable ? 'cursor-pointer hover:shadow-2xl hover:shadow-indigo-500/10 hover:scale-[1.02] hover:border-indigo-400/40' : 'hover:shadow-lg'}
        ${className}
      `}
    >
      {/* Background Decoration */}
      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl" />
      
      <div className="relative">
        {/* Header with Icon */}
        <div className="flex items-start justify-between mb-6">
          {icon && (
            <div className="p-4 rounded-[1.5rem] bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm">
              {icon}
            </div>
          )}
          {trend && (
            <div className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider
              ${trend.isPositive 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }
            `}>
              <span className="text-lg leading-none">{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        {/* Title */}
        <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-2">
          {title}
        </p>

        {/* Value */}
        <h3 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-1">
          {value}
        </h3>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-semibold">
            {subtitle}
          </p>
        )}

        {/* Trend Label */}
        {trend?.label && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-wide">
            {trend.label}
          </p>
        )}
      </div>
    </div>
  );
};
