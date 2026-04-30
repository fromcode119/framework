"use client";

import React from 'react';

interface PageHeadingProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export const PageHeading = ({
  title,
  subtitle,
  icon,
  badge,
  className = '',
  titleClassName = 'text-3xl sm:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none italic',
  subtitleClassName = 'text-xs font-bold text-slate-400 dark:text-slate-500 tracking-tight opacity-80 mt-3'
}: PageHeadingProps) => {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        {icon}
        <h1 className={`min-w-0 ${titleClassName}`}>{title}</h1>
        {badge}
      </div>
      {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
    </div>
  );
};
