"use client";

import React from 'react';
import { useTheme } from '@/components/ThemeContext';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  icon?: React.ReactNode;
  as?: any;
  href?: string;
  target?: string;
}

export const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '', 
  isLoading, 
  icon,
  as: Component = 'button',
  ...props 
}: ButtonProps) => {
  const { theme } = useTheme();

  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20',
    secondary: theme === 'dark' ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-transparent' : 'bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20',
    ghost: theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-100' : 'hover:bg-slate-100/80 text-slate-600 hover:text-slate-900',
    outline: `border ${theme === 'dark' ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`,
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2',
  };

  return (
    <Component
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </Component>
  );
};
