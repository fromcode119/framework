"use client";

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
}

export const Input = ({ label, error, className = '', ...props }: InputProps) => {
  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      {label && <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</label>}
      <input
        className={`w-full rounded-2xl py-3 px-4 text-sm font-medium outline-none border transition-all 
          bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm
          dark:bg-slate-900 dark:border-slate-800 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-0
          ${error ? 'border-rose-500 focus:border-rose-500/20 bg-rose-50/30 dark:bg-rose-500/5 animate-shake shadow-[0_0_20px_rgba(244,63,94,0.1)]' : ''}`}
        {...props}
      />
      {error && (
        <div className="flex items-center gap-2 px-1 animate-fade-in-up">
          <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.15em] leading-none">
            {error}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-rose-500/20 to-transparent" />
        </div>
      )}
    </div>
  );
};
