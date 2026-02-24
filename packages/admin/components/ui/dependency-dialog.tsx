"use client";

import React, { useEffect } from 'react';
import { Button } from './button';
import { FrameworkIcons } from '../../lib/icons';
import { RootFramework } from './root-framework';
import { useTheme } from '../../components/theme-context';

const { Warning: AlertTriangle, Close: X, Box } = FrameworkIcons;

export interface DependencyIssue {
  slug: string;
  expected: string;
  actual?: string;
  type: 'missing' | 'incompatible' | 'inactive';
}

interface DependencyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (recursive: boolean, force: boolean) => void;
  issues: DependencyIssue[];
  pluginSlug: string;
  isLoading?: boolean;
}

export const DependencyDialog = ({
  isOpen,
  onClose,
  onConfirm,
  issues,
  pluginSlug,
  isLoading = false
}: DependencyDialogProps) => {
  const { theme } = useTheme();
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasMissing = issues.some(i => i.type === 'missing');
  const hasIncompatible = issues.some(i => i.type === 'incompatible');
  const onlyInactive = issues.every(i => i.type === 'inactive');

  const primaryLabel = hasMissing 
    ? "Install & Enable All" 
    : onlyInactive 
      ? "Enable Dependencies" 
      : "Resolve & Activate";

  return (
    <RootFramework>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" 
          onClick={onClose}
        />
        
        <div className="relative w-full max-w-lg my-auto rounded-3xl border shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 bg-white border-slate-100 shadow-slate-200/50 dark:bg-slate-900 dark:border-slate-800 dark:shadow-black/50">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl flex-shrink-0 ${hasMissing ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500'}`}>
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {hasMissing ? 'Missing Requirements Found' : 'Inactive Dependencies Detected'}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                To enable <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">{pluginSlug}</span>, we need to handle the following:
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1 rounded-lg transition-colors hover:bg-slate-50 text-slate-400 hover:text-slate-900 dark:hover:bg-slate-800 dark:text-slate-500 dark:hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-6 space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            {issues.map((issue, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center border shadow-sm ${
                  issue.type === 'missing' ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-900/30' : 
                  'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}>
                  <Box size={20} className={issue.type === 'missing' ? 'text-rose-500' : 'text-indigo-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">{issue.slug}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight ${
                      issue.type === 'missing' ? 'bg-rose-500 text-white' :
                      issue.type === 'inactive' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-500'
                    }`}>
                      {issue.type === 'missing' ? 'NOT INSTALLED' : issue.type.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {issue.type === 'missing' && `Requires version ${issue.expected}. We can download this from the marketplace.`}
                    {issue.type === 'inactive' && `Already installed but needs to be activated (Version ${issue.expected}).`}
                    {issue.type === 'incompatible' && `Version mismatch: requires ${issue.expected}, found ${issue.actual}.`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            {!hasIncompatible && (
              <Button 
                variant="primary" 
                className={`w-full py-6 rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-lg ${
                  hasMissing ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'shadow-indigo-500/20'
                }`} 
                onClick={() => onConfirm(true, false)}
                isLoading={isLoading}
              >
                {primaryLabel}
              </Button>
            )}
            
            <div className={`p-4 rounded-xl text-[10px] font-medium leading-tight ${theme === 'dark' ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
              Activating without dependencies may cause the system to behave unexpectedly or crash if the plugin relies on them for core data.
            </div>

            <Button 
              variant="ghost" 
              className="w-full py-6 rounded-2xl font-bold uppercase tracking-widest text-[11px] border-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800" 
              onClick={() => onConfirm(false, true)}
              disabled={isLoading}
            >
              Force Activate Anyway
            </Button>

            <Button 
              variant="ghost" 
              className="w-full" 
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </RootFramework>
  );
};
