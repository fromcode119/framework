"use client";

import React from 'react';
import { PageHeading } from '../../components/ui/page-heading';

interface PluginPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  subtitleClassName?: string;
  titleClassName?: string;
}

export const PluginPageHeader = ({
  title,
  subtitle,
  icon,
  actions,
  badge,
  subtitleClassName = 'text-xs font-bold text-slate-400 dark:text-slate-500 tracking-tight opacity-80 mt-3',
  titleClassName = 'text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none italic'
}: PluginPageHeaderProps) => {
  return (
    <div className="sticky top-0 z-30 border-b backdrop-blur-3xl transition-all duration-300 bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)] dark:bg-slate-950/80 dark:border-slate-800/50 dark:shadow-2xl dark:shadow-black/20 -mx-8 -mt-8 px-8 py-8 mb-8">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <PageHeading
            title={title}
            subtitle={subtitle}
            icon={
              icon ? (
                <div className="h-11 w-11 rounded-full flex items-center justify-center shadow-lg transform -rotate-3 transition-transform hover:rotate-0 bg-indigo-600 text-white dark:bg-indigo-500/10 dark:text-indigo-400 dark:border dark:border-indigo-500/20">
                  {icon}
                </div>
              ) : undefined
            }
            badge={badge}
            titleClassName={titleClassName}
            subtitleClassName={subtitleClassName}
          />
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
