"use client";

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
  inputClassName?: string;
}

export const Input = ({ label, error, className = '', inputClassName = '', value, ...props }: InputProps) => {
  // Normalize the value to a string/number, handling objects if they slip through
  const normalizedValue = React.useMemo(() => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (value as any).label || (value as any).name || (value as any).title || (value as any).slug || (value as any).value || (value as any).id || '';
    }
    return value;
  }, [value]);

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && <label className="text-xs font-bold text-slate-500 mb-0">{label}</label>}
      <input
        {...props}
        value={normalizedValue}
        className={`w-full rounded-xl outline-none border transition-all font-medium
          bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm
          dark:bg-slate-900 dark:border-slate-800 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-0
          ${!inputClassName.includes('py-') ? 'py-2 ' : ''}${!inputClassName.includes('px-') ? 'px-3 ' : ''}${!inputClassName.includes('text-') ? 'text-sm ' : ''}
          ${error ? 'border-rose-500 focus:border-rose-500/20 bg-rose-50/30 dark:bg-rose-500/5 animate-shake shadow-[0_0_20px_rgba(244,63,94,0.1)]' : ''} ${inputClassName}`}
      />
      {error && (
        <div className="flex items-center gap-2 px-1 animate-fade-in-up">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.15em] leading-none">
            {error}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-rose-500/20 to-transparent" />
        </div>
      )}
    </div>
  );
};
