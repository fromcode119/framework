"use client";

import React from 'react';
import { useTheme } from '@/components/ThemeContext';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  title?: string;
}

export const Card = ({ children, className = "", noPadding = false, title, ...props }: CardProps) => {
  const { theme } = useTheme();
  
  return (
    <div 
      {...props}
      className={`rounded-3xl border ${
        theme === 'dark' 
          ? 'bg-slate-900/50 border-slate-800' 
          : 'bg-white border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]'
      } ${noPadding ? '' : 'p-10'} ${className}`}
    >
      {title && <h3 className={`font-black uppercase tracking-tight text-lg mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{title}</h3>}
      {children}
    </div>
  );
};

export const CardHeader = ({ title, subtitle, description, badge }: { title: string, subtitle?: string, description?: string, badge?: React.ReactNode }) => {
  const { theme } = useTheme();
  const desc = description || subtitle;
  
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
        {desc && <p className="text-xs text-slate-500 mt-1">{desc}</p>}
      </div>
      {badge}
    </div>
  );
};
