"use client";

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  title?: string;
}

export const Card = ({ children, className = "", noPadding = false, title, ...props }: CardProps) => {
  return (
    <div 
      {...props}
      className={`rounded-3xl border bg-white border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:bg-slate-900/50 dark:border-slate-800 dark:shadow-none ${noPadding ? '' : 'p-5'} ${className}`}
    >
      {title && <h3 className="font-bold tracking-tight text-base mb-4 text-slate-800 dark:text-slate-100">{title}</h3>}
      {children}
    </div>
  );
};

export const CardHeader = ({ title, subtitle, description, badge }: { title: string, subtitle?: string, description?: string, badge?: React.ReactNode }) => {
  const desc = description || subtitle;
  
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">{title}</h3>
        {desc && <p className="text-xs text-slate-500 mt-1">{desc}</p>}
      </div>
      {badge}
    </div>
  );
};
