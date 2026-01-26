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
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      {label && <label className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>{label}</label>}
      <input
        className={`w-full rounded-2xl py-3 px-4 text-sm font-medium outline-none border transition-all ${
          theme === 'dark' 
            ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' 
            : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm'
        } ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
        {...props}
      />
      {error && <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">{error}</span>}
    </div>
  );
};
