"use client";

import React from 'react';
import { ThemeHooks } from '@/components/use-theme';

interface LoaderProps {
  label?: string;
  className?: string;
  fullPage?: boolean;
}

export const Loader = ({ 
  label = "Synchronizing Data", 
  className = "", 
  fullPage = false 
}: LoaderProps) => {
  const { theme } = ThemeHooks.useTheme();
  
  const content = (
    <div className={`flex flex-col items-center justify-center gap-6 ${className}`}>
      <div className="relative">
        <div className={`h-16 w-16 border-4 rounded-full animate-spin transition-colors duration-500 ${
          theme === 'dark' ? 'border-indigo-500/10 border-t-indigo-500' : 'border-indigo-100 border-t-indigo-600'
        }`}></div>
        <div className="absolute inset-0 flex items-center justify-center">
           <div className={`h-8 w-8 rounded-xl animate-pulse transition-colors duration-500 ${
             theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-50'
           }`}></div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className={`font-semibold text-[10px] tracking-widest animate-pulse transition-colors duration-500 ${
          theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
        }`}>
          {label}
        </p>
        <div className="flex gap-1.5 mt-1">
            <div className={`h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.3s] ${theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600'}`}></div>
            <div className={`h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.15s] ${theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600'}`}></div>
            <div className={`h-1.5 w-1.5 rounded-full animate-bounce ${theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600'}`}></div>
        </div>
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className={`fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-xl ${
        theme === 'dark' ? 'bg-slate-950/60' : 'bg-white/60'
      }`}>
        {content}
      </div>
    );
  }

  return (
    <div className="py-20 flex items-center justify-center">
      {content}
    </div>
  );
};
