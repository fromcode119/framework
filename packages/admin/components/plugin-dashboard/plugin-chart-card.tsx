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

export const PluginChartCard = ({ 
  title, 
  subtitle, 
  actions, 
  children,
  className = "",
  noPadding = false
}: PluginChartCardProps) => {
  return (
    <div 
      className={`
        rounded-[2.5rem] border-2 border-slate-200/80 
        bg-white 
        shadow-sm 
        transition-all duration-300 
        hover:shadow-lg
        dark:bg-slate-900/50 
        dark:border-slate-700/50
        ${noPadding ? '' : 'p-8'}
        ${className}
      `}
    >
      {/* Header */}
      <div className={`flex items-start justify-between ${noPadding ? 'px-8 pt-8 pb-6' : 'mb-6'}`}>
        <div className="flex-1">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2 opacity-70">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={noPadding ? 'px-8 pb-8' : ''}>
        {children}
      </div>
    </div>
  );
};
