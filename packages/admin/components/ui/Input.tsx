"use client";

import React from 'react';
import { useTheme } from '@/components/ThemeContext';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
}

export const Input = ({ label, error, className = '', ...props }: InputProps) => {
  const { theme } = useTheme();

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && <label className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{label}</label>}
      <input
        className={`rounded-xl py-2.5 px-4 text-sm outline-none border transition-all ${
          theme === 'dark' 
            ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500/50' 
            : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'
        } ${error ? 'border-rose-500 focus:border-rose-500' : ''}`}
        {...props}
      />
      {error && <span className="text-[10px] font-bold text-rose-500">{error}</span>}
    </div>
  );
};
