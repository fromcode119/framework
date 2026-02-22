"use client";

import React from 'react';
import { getFieldClasses, UI_TEXT } from '@/lib/ui';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  className?: string;
  inputClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(({ 
  label, 
  error, 
  className = '', 
  inputClassName = '', 
  value, 
  size = 'md',
  ...props 
}, ref) => {
  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && <label className={UI_TEXT.LABEL}>{label}</label>}
      <textarea
        {...props}
        ref={ref}
        value={value}
        className={`${getFieldClasses(size, `resize-none min-h-[100px] ${inputClassName}`)} 
          ${error ? 'border-rose-500 focus:border-rose-500/20 bg-rose-50/30 dark:bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : ''}`}
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
});

TextArea.displayName = 'TextArea';
