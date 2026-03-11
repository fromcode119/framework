"use client";

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  title?: string;
  icon?: React.ReactNode;
}

export function Card({ children, className = "", noPadding = false, title, ...props }: CardProps) {
  return (
    <div 
      {...props}
      className={`rounded-xl border bg-white border-slate-200/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800 dark:shadow-none ${noPadding ? '' : 'p-6'} ${className}`}
    >
      {title && <h3 className="font-semibold tracking-tight text-[13px] mb-4 text-slate-800 dark:text-slate-100">{title}</h3>}
      {children}
    </div>
  );
}
