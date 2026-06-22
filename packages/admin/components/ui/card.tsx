"use client";

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  title?: string;
  icon?: React.ReactNode;
}

export class Card extends React.Component<CardProps> {
  render(): React.ReactNode {
    const { children, className = "", noPadding = false, title, ...props } = this.props;
  return (
    <div
      {...props}
      className={`rounded-xl border bg-white border-slate-200/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800 dark:shadow-none ${noPadding ? '' : 'p-4'} ${className}`}
    >
      {title && <h3 className="font-semibold tracking-tight text-[13px] mb-3 text-slate-800 dark:text-slate-100">{title}</h3>}
      {children}
    </div>
  );
  }
}
