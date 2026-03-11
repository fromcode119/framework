"use client";

import React, { useEffect } from 'react';
import { Button } from './button';
import { FrameworkIcons } from '@/lib/icons';
import { RootFramework } from '@fromcode119/react';
import type { UploadPreviewSection } from '@/components/ui/upload-preview-dialog.interfaces';

const { Warning: AlertTriangle, Close: X } = FrameworkIcons;

interface UploadPreviewDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  sections: UploadPreviewSection[];
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function UploadPreviewDialog({
  isOpen,
  title,
  description,
  sections,
  confirmLabel = 'Install',
  cancelLabel = 'Cancel',
  isLoading = false,
  onClose,
  onConfirm,
}: UploadPreviewDialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <RootFramework>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={onClose}
        />

        <div className="relative w-full max-w-2xl my-auto rounded-3xl border shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 bg-white border-slate-100 shadow-slate-200/50 dark:bg-slate-900 dark:border-slate-800 dark:shadow-black/50">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl flex-shrink-0 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h3>
              {description ? (
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg transition-colors hover:bg-slate-50 text-slate-400 hover:text-slate-900 dark:hover:bg-slate-800 dark:text-slate-500 dark:hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-6 space-y-4 max-h-[45vh] overflow-auto pr-1">
            {sections.map((section) => (
              <div
                key={section.title}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {section.title}
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {section.items.length === 0 ? (
                    <li className="text-sm text-slate-500 dark:text-slate-400">None</li>
                  ) : (
                    section.items.map((item, index) => (
                      <li key={`${section.title}-${index}`} className="text-sm text-slate-700 dark:text-slate-200">
                        {item}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}
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
              variant="primary"
              className="flex-1"
              onClick={onConfirm}
              isLoading={isLoading}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </RootFramework>
  );
}
