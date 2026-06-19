"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { DataTablePaginationProps } from './data-table.interfaces';

/** Pagination footer for {@link DataTable}. Renders nothing unless there is more than one page. */
export class DataTablePagination extends React.Component<DataTablePaginationProps> {
  render(): React.ReactNode {
    const { totalDocs, limit, page, onPageChange } = this.props;
    const totalPages = Math.ceil(totalDocs / limit);
    if (totalPages <= 1) return null;

    const startRecord = totalDocs > 0 ? ((page - 1) * limit) + 1 : 0;
    const endRecord = totalDocs > 0 ? Math.min(page * limit, totalDocs) : 0;
    const maxPageButtons = 5;
    const windowStart = totalPages <= maxPageButtons
      ? 1
      : Math.min(Math.max(1, page - Math.floor(maxPageButtons / 2)), totalPages - maxPageButtons + 1);
    const windowEnd = totalPages <= maxPageButtons
      ? totalPages
      : Math.min(totalPages, windowStart + maxPageButtons - 1);
    const visiblePages = Array.from({ length: Math.max(0, windowEnd - windowStart + 1) }, (_, i) => windowStart + i);

    return (
        <div className="flex items-center justify-between px-8 py-5 border-t transition-all bg-slate-50/50 border-slate-100 dark:bg-slate-950/40 dark:border-slate-800/50">
          <p className="text-[12px] font-semibold text-slate-400 tracking-wide">
            Showing <span className="text-slate-900 dark:text-white">{startRecord}-{endRecord}</span> of <span className="text-slate-900 dark:text-white">{totalDocs}</span> records
          </p>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => onPageChange?.(page - 1)} className="p-2 rounded-lg transition-all border bg-white border-slate-200 text-slate-600 disabled:opacity-50 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:disabled:opacity-20">
              <FrameworkIcons.Left size={16} />
            </button>
            <div className="flex items-center gap-1">
              {windowStart > 1 && (
                <>
                  <button onClick={() => onPageChange?.(1)} className="h-9 w-9 text-[11px] font-bold rounded-lg transition-all bg-white text-slate-500 hover:text-indigo-600 border border-slate-200 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:border-transparent">1</button>
                  {windowStart > 2 && <span className="text-slate-400 mx-1">...</span>}
                </>
              )}
              {visiblePages.map((pageNum) => (
                <button key={pageNum} onClick={() => onPageChange?.(pageNum)}
                  className={`h-9 w-9 text-[11px] font-bold rounded-lg transition-all ${page === pageNum ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white text-slate-500 hover:text-indigo-600 border border-slate-200 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:border-transparent'}`}>
                  {pageNum}
                </button>
              ))}
              {windowEnd < totalPages && (
                <>
                  {windowEnd < totalPages - 1 && <span className="text-slate-400 mx-1">...</span>}
                  <button onClick={() => onPageChange?.(totalPages)} className="h-9 w-9 text-[11px] font-bold rounded-lg transition-all bg-white text-slate-500 hover:text-indigo-600 border border-slate-200 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:border-transparent">{totalPages}</button>
                </>
              )}
            </div>
            <button disabled={page === totalPages} onClick={() => onPageChange?.(page + 1)} className="p-2 rounded-lg transition-all border bg-white border-slate-200 text-slate-600 disabled:opacity-50 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:disabled:opacity-20">
              <FrameworkIcons.Right size={16} />
            </button>
          </div>
        </div>
    );
  }
}
