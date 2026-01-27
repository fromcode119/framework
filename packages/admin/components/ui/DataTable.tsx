"use client";

import React, { useState } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { FrameworkIcons } from '@/lib/icons';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  id: string;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  totalDocs?: number;
  limit?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onSort?: (sort: string) => void;
  currentSort?: string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
}

export function DataTable<T extends { id: any }>({
  columns,
  data,
  loading,
  totalDocs = 0,
  limit = 10,
  page = 1,
  onPageChange,
  onSort,
  currentSort,
  onRowClick,
  actions,
  emptyMessage = "No records found"
}: DataTableProps<T>) {
  const { theme } = useTheme();

  const handleSort = (columnId: string) => {
    if (!onSort) return;
    const isDesc = currentSort === `-${columnId}`;
    onSort(isDesc ? columnId : `-${columnId}`);
  };

  const getSortIcon = (columnId: string) => {
    if (currentSort === columnId) return <FrameworkIcons.Up size={12} />;
    if (currentSort === `-${columnId}`) return <FrameworkIcons.Down size={12} />;
    return <FrameworkIcons.Down size={12} className="opacity-20" />;
  };

  const totalPages = Math.ceil(totalDocs / limit);

  return (
    <div className={`flex flex-col w-full h-full transition-all duration-300 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50/50'} border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
              {columns.map((col) => (
                <th 
                  key={col.id} 
                  className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-500 ${col.sortable ? 'cursor-pointer hover:text-indigo-500 transition-colors' : ''} ${col.className || ''}`}
                  onClick={() => col.sortable && handleSort(col.id)}
                >
                  <div className="flex items-center gap-2">
                    {col.header}
                    {col.sortable && getSortIcon(col.id)}
                  </div>
                </th>
              ))}
              {actions && (
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-500 text-right">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {data.length === 0 && !loading ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'}`}>
                      <FrameworkIcons.Search size={20} className="text-slate-400" />
                    </div>
                    <p className="font-bold text-slate-500 uppercase tracking-widest text-[11px]">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr 
                  key={row.id || row.key || row.slug || index} 
                  className={`transition-colors cursor-default ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-indigo-50/30'}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col.id} className={`px-6 py-4 ${col.className || ''}`}>
                      <div className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                        {typeof col.accessor === 'function' 
                          ? col.accessor(row) 
                          : (String(row[col.accessor]) || '-')}
                      </div>
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-4 text-right">
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={`flex items-center justify-between px-6 py-4 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'} bg-slate-50/20 dark:bg-slate-900/10`}>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            Showing <span className={`${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{data.length}</span> of <span className={`${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{totalDocs}</span> records
          </p>
          
          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1}
              onClick={() => onPageChange?.(page - 1)}
              className={`p-2 rounded-lg transition-all border ${
                theme === 'dark' 
                  ? 'bg-slate-800 border-slate-700 text-slate-400 disabled:opacity-20' 
                  : 'bg-white border-slate-200 text-slate-600 disabled:opacity-50 shadow-sm'
              }`}
            >
              <FrameworkIcons.Left size={16} />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                // Simple logic for showing pages around current page could be added here
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange?.(pageNum)}
                    className={`h-9 w-9 text-[11px] font-black rounded-lg transition-all ${
                      page === pageNum 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                        : theme === 'dark' 
                          ? 'bg-slate-800 text-slate-400 hover:text-white' 
                          : 'bg-white text-slate-500 hover:text-indigo-600 border border-slate-200 shadow-sm'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="text-slate-400 mx-1">...</span>}
            </div>

            <button 
              disabled={page === totalPages}
              onClick={() => onPageChange?.(page + 1)}
              className={`p-2 rounded-lg transition-all border ${
                theme === 'dark' 
                  ? 'bg-slate-800 border-slate-700 text-slate-400 disabled:opacity-20' 
                  : 'bg-white border-slate-200 text-slate-600 disabled:opacity-50 shadow-sm'
              }`}
            >
              <FrameworkIcons.Right size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
