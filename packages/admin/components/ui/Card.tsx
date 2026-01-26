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
      className={`rounded-2xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'} ${noPadding ? '' : 'p-6'} ${className}`}
    >
      {title && <h3 className={`font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{title}</h3>}
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
