"use client";

import React from 'react';

interface PluginPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export const PluginPageHeader = ({ title, subtitle, icon, actions, badge }: PluginPageHeaderProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="text-indigo-600 dark:text-indigo-400">
                {icon}
              </div>
            )}
            <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none italic">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest opacity-70 mt-3">
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
    </div>
  );
};
