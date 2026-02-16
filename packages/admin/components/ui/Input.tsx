"use client";

import React from 'react';
import { getFieldClasses, UI_TEXT } from '@/lib/ui';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  className?: string;
  inputClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Input = ({ label, error, className = '', inputClassName = '', value, size = 'md', ...props }: InputProps) => {
  // Normalize the value to a string/number, handling objects if they slip through
  const normalizedValue = React.useMemo(() => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (value as any).label || (value as any).name || (value as any).title || (value as any).slug || (value as any).value || (value as any).id || '';
    }
    return value;
  }, [value]);

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && <label className={UI_TEXT.LABEL}>{label}</label>}
      <input
        {...props}
        value={normalizedValue}
        className={`${getFieldClasses(size, inputClassName)} 
          ${error ? 'border-rose-500 focus:border-rose-500/20 bg-rose-50/30 dark:bg-rose-500/5 animate-shake shadow-[0_0_20px_rgba(244,63,94,0.1)]' : ''}`}
      />
      {error && (
        <div className="flex items-center gap-2 px-1 animate-fade-in-up">
          <span className={UI_TEXT.ERROR}>
            {error}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-rose-500/20 to-transparent" />
        </div>
      )}
    </div>
  );
};
