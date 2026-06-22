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

export class PageHeading extends React.Component<PageHeadingProps> {
  render(): React.ReactNode {
    const {
  title,
  subtitle,
  icon,
  badge,
  className = '',
  titleClassName = 'text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight',
  subtitleClassName = 'text-xs font-medium text-slate-500 dark:text-slate-500 tracking-tight mt-0.5'
} = this.props;
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
  }
}
