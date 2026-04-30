"use client";

import React from 'react';
import { PageHeading } from '@/components/ui/page-heading';

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
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex-1 min-w-0">
          <PageHeading
            title={title}
            subtitle={subtitle}
            icon={
              icon ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform hover:rotate-0 dark:border dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 sm:h-11 sm:w-11 md:-rotate-3">
                  <span className="flex h-5 w-5 items-center justify-center [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0">
                    {icon}
                  </span>
                </div>
              ) : undefined
            }
            badge={badge}
            titleClassName={titleClassName}
            subtitleClassName={subtitleClassName}
          />
        </div>
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
