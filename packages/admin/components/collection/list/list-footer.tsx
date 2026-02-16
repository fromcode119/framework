"use client";

import React from 'react';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

interface ListFooterProps {
  theme: string;
  slug: string;
  total: number;
  resolvedSlug: string;
  handleExport: (format: 'json' | 'csv') => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ListFooter: React.FC<ListFooterProps> = ({
  theme,
  slug,
  total,
  resolvedSlug,
  handleExport,
  handleImport
}) => {
  return (
    <div className={`mt-auto border-t py-12 backdrop-blur-3xl transition-all duration-300 ${
      theme === 'dark' 
        ? 'bg-slate-950/40 border-slate-800' 
        : 'bg-slate-50/50 border-slate-100'
    }`}>
      <div className="w-full px-6 lg:px-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)] animate-pulse" />
              <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                Data Management Node // {slug.toUpperCase()}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 tracking-wide text-center md:text-left">
              Connected to {total} records in the system cluster.
            </p>
          </div>
          
          <div className="flex items-center gap-10 text-xs font-semibold tracking-wide text-slate-400">
            <button 
              onClick={() => handleExport('json')}
              className="hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300"
            >
              Export JSON
            </button>
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <label 
              className="cursor-pointer hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300"
            >
              Bulk Import
              <input type="file" className="hidden" accept=".json" onChange={handleImport} />
            </label>
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <a 
              href={`${api.getBaseUrl()}${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}`} 
              target="_blank" 
              className="hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300"
            >
              API Endpoint
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
