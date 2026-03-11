"use client";

import React from 'react';
import Link from 'next/link';
import { ThemeHooks } from '@/components/use-theme';
import { FrameworkIcons } from '@/lib/icons';

export default function NotFound() {
  const { theme } = ThemeHooks.useTheme();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 animate-in fade-in duration-500">
      <div className={`p-6 rounded-3xl ${theme === 'dark' ? 'bg-indigo-900/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'} mb-8`}>
        <FrameworkIcons.Search size={64} strokeWidth={1.5} />
      </div>
      
      <h1 className={`text-6xl font-semibold mb-4 tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        404
      </h1>
      
      <h2 className={`text-2xl font-semibold mb-4 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
        Page not found
      </h2>
      
      <p className={`max-w-md mx-auto mb-10 leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
        We couldn't find the page you're looking for. It might have been moved, deleted, or never existed in the first place.
      </p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button 
          onClick={() => window.history.back()}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all border ${
            theme === 'dark' 
              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' 
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
          }`}
        >
          <FrameworkIcons.Left size={18} />
          <span>Go Back</span>
        </button>
        
        <Link 
          href="/"
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-600/20"
        >
          <FrameworkIcons.Home size={18} />
          <span>Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
