"use client";

import React, { useEffect } from 'react';
import { Button } from './Button';
import { FrameworkIcons } from '@/lib/icons';
import { Portal } from './Portal';

const { Warning: AlertTriangle, Close: X } = FrameworkIcons;

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false
}: ConfirmDialogProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

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
        <div className="relative w-full max-w-md my-auto rounded-3xl border shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 bg-white border-slate-100 shadow-slate-200/50 dark:bg-slate-900 dark:border-slate-800 dark:shadow-black/50">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl flex-shrink-0 ${
              variant === 'danger' 
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500'
                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-500'
            }`}>
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1 rounded-lg transition-colors hover:bg-slate-50 text-slate-400 hover:text-slate-900 dark:hover:bg-slate-800 dark:text-slate-500 dark:hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button 
              variant="ghost" 
              className="flex-1" 
              onClick={onClose}
              disabled={isLoading}
            >
              {cancelLabel}
            </Button>
            <Button 
              variant={variant === 'danger' ? 'danger' : 'primary'} 
              className="flex-1" 
              onClick={onConfirm}
              isLoading={isLoading}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
