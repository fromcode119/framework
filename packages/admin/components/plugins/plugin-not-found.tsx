"use client";

import React from 'react';
import { FrameworkIcons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface PluginNotFoundProps {
  pluginSlug: string;
}

export const PluginNotFound = ({ pluginSlug }: PluginNotFoundProps) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-700 slide-in-from-bottom-4">
      <div className="p-8 rounded-[40px] mb-8 relative group bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200 dark:shadow-black/50">
        <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
        <FrameworkIcons.Zap size={64} className="text-rose-500 relative z-10 animate-pulse" strokeWidth={1} />
      </div>
      
      <h1 className="text-4xl font-bold tracking-tighter text-slate-900 dark:text-white mb-4">Module Not Found</h1>
      
      <p className="text-slate-500 font-semibold text-center max-w-sm leading-relaxed mb-10 px-6">
        The <span className="text-rose-500 font-bold px-2 py-0.5 bg-rose-50 dark:bg-rose-500/10 rounded-md">/{pluginSlug}</span> module is not registered or currently inactive in your cluster.
      </p>

      <div className="flex items-center gap-4">
        <Link href="/plugins">
          <Button 
            variant="primary" 
            className="rounded-2xl px-10 py-5 font-bold tracking-tight text-[13px] shadow-2xl shadow-rose-500/20 bg-rose-500 hover:bg-rose-600 border-none transition-all hover:scale-105 active:scale-95"
            icon={<FrameworkIcons.Plugins size={18} />}
          >
            Manage Plugins
          </Button>
        </Link>
        <Button 
          variant="ghost" 
          onClick={() => window.history.back()}
          className="rounded-2xl px-8 font-bold tracking-tight text-[13px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
          icon={<FrameworkIcons.Left size={16} />}
        >
          Go Back
        </Button>
      </div>
    </div>
  );
};
