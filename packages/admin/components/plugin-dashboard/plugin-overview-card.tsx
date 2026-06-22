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

export class PluginOverviewCard extends React.Component<PluginOverviewCardProps> {
  render(): React.ReactNode {
    const { 
  title, 
  value, 
  icon, 
  trend, 
  subtitle, 
  onClick,
  className = "" 
} = this.props;
  const isClickable = !!onClick;
  
  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 transition-colors dark:bg-slate-900/50 dark:border-slate-800 ${isClickable ? 'cursor-pointer hover:border-indigo-400/40' : ''} ${className}`}
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
