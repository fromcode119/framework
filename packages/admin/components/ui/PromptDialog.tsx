"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { Button } from './Button';
import { Input } from './Input';
import { FrameworkIcons } from '@/lib/icons';
import { Portal } from './Portal';

const { Close: X } = FrameworkIcons;

interface PromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const PromptDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  placeholder = 'Enter value...',
  defaultValue = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  icon
}: PromptDialogProps) => {
  const { theme } = useTheme();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" 
          onClick={onClose}
        />
        
        {/* Dialog */}
        <div className={`relative w-full max-w-md my-auto rounded-3xl border shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200/50'
        }`}>
        <div className="flex items-start gap-4 mb-6">
          {icon && (
            <div className={`p-3 rounded-xl flex-shrink-0 ${
              theme === 'dark' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'
            }`}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h3>
            {description && (
              <p className={`mt-1 text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {description}
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500 hover:text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input 
            ref={inputRef}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isLoading}
            className="w-full"
            autoFocus
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="ghost" 
              className="flex-1" 
              onClick={onClose}
              type="button"
              disabled={isLoading}
            >
              {cancelLabel}
            </Button>
            <Button 
              variant="primary" 
              className="flex-1" 
              type="submit"
              isLoading={isLoading}
              disabled={!value.trim()}
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
};
