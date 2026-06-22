"use client";

import React from 'react';

interface PluginChartCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export class PluginChartCard extends React.Component<PluginChartCardProps> {
  render(): React.ReactNode {
    const { 
  title, 
  subtitle, 
  actions, 
  children,
  className = "",
  noPadding = false
} = this.props;
  return (
    <div
      className={`rounded-xl border border-slate-200/70 bg-white shadow-sm transition-colors dark:bg-slate-900/50 dark:border-slate-800 ${noPadding ? '' : 'p-4'} ${className}`}
    >
      {/* Header */}
      <div className={`flex items-start justify-between ${noPadding ? 'px-4 pt-4 pb-3' : 'mb-3'}`}>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={noPadding ? 'px-4 pb-4' : ''}>
        {children}
      </div>
    </div>
  );
  }
}
