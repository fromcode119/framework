"use client";

import React from 'react';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
  className?: string;
}

export const SectionCard = ({
  title,
  subtitle,
  icon,
  actions,
  children,
  noPadding = false,
  className = '',
}: SectionCardProps) => {
  return (
    <section className={`rounded-3xl border overflow-hidden bg-white border-slate-100 shadow-lg shadow-slate-200/50 dark:bg-slate-900/40 dark:border-slate-800 dark:shadow-none ${className}`}>
      <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">{title}</h2>
            {subtitle && (
              <p className="text-[10px] font-bold tracking-tight text-slate-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>
      {noPadding ? children : <div className="p-6">{children}</div>}
    </section>
  );
};
