"use client";

import React, { useState } from 'react';
import { FrameworkIcons } from '../../lib/icons';

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
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  expandedRowId?: string | null;
  renderExpandedRow?: (row: T) => React.ReactNode;
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
  emptyMessage = "No records found",
  selectable,
  selectedIds = [],
  onSelectionChange,
  expandedRowId = null,
  renderExpandedRow
}: DataTableProps<T>) {
  const handleSort = (columnId: string) => {
    if (!onSort) return;
    const isDesc = currentSort === `-${columnId}`;
    onSort(isDesc ? columnId : `-${columnId}`);
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (selectedIds.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map(row => String(row.id)));
    }
  };

  const toggleOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    const stringId = String(id);
    if (selectedIds.includes(stringId)) {
      onSelectionChange(selectedIds.filter(i => i !== stringId));
    } else {
      onSelectionChange([...selectedIds, stringId]);
    }
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
            <tr className="bg-slate-100/50 border-b border-slate-200/60 dark:bg-slate-900/50 dark:border-slate-800">
              {selectable && (
                <th className="px-5 py-4 w-4">
                  <div 
                    onClick={toggleAll}
                    className={`w-4 h-4 rounded border-2 cursor-pointer transition-all flex items-center justify-center ${
                      selectedIds.length > 0 && selectedIds.length === data.length
                        ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/20' 
                        : selectedIds.length > 0 
                          ? 'bg-indigo-600/50 border-indigo-600' 
                          : 'bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600'
                    }`}
                  >
                    {selectedIds.length > 0 && (
                      <div className={`w-2 h-0.5 bg-white rounded-full ${selectedIds.length === data.length ? 'hidden' : 'block'}`} />
                    )}
                    {selectedIds.length === data.length && data.length > 0 && (
                      <FrameworkIcons.Check size={10} className="text-white" strokeWidth={3} />
                    )}
                  </div>
                </th>
              )}
              {columns.map((col) => (
                <th 
                  key={col.id} 
                  className={`px-5 py-4 text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide ${col.sortable ? 'cursor-pointer hover:text-indigo-500 transition-colors' : ''} ${col.className || ''}`}
                  onClick={() => col.sortable && handleSort(col.id)}
                >
                  <div className="flex items-center gap-2">
                    {col.header}
                    {col.sortable && getSortIcon(col.id)}
                  </div>
                </th>
              ))}
              {actions && (
                <th className="px-5 py-4 text-[11px] font-semibold text-slate-400 dark:text-slate-500 text-right tracking-wide">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/50">
            {data.length === 0 && !loading ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0)} className="px-6 py-24 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-14 h-14 rounded-3xl flex items-center justify-center mb-4 bg-slate-50 border border-slate-100 dark:bg-slate-800 dark:border-transparent">
                      <FrameworkIcons.Search size={22} className="text-slate-400" />
                    </div>
                    <p className="font-semibold text-slate-400 tracking-wide text-[12px]">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const rowKey = String(row.id || (row as any).key || (row as any).slug || index);
                const isExpanded = expandedRowId !== null && String(expandedRowId) === String(row.id);
                return (
                  <React.Fragment key={rowKey}>
                    <tr 
                      className={`transition-all duration-200 cursor-default hover:bg-slate-50/80 dark:hover:bg-slate-800/30 ${
                        onRowClick ? 'cursor-pointer' : ''
                      } ${selectedIds.includes(String(row.id)) ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : ''}`}
                      onClick={() => onRowClick?.(row)}
                    >
                      {selectable && (
                        <td className="px-5 py-3 w-4" onClick={(e) => toggleOne(String(row.id), e)}>
                          <div 
                            className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${
                              selectedIds.includes(String(row.id))
                                ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/20' 
                                : 'bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600'
                            }`}
                          >
                            {selectedIds.includes(String(row.id)) && (
                              <FrameworkIcons.Check size={10} className="text-white" strokeWidth={3} />
                            )}
                          </div>
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.id} className={`px-5 py-3 ${col.className || ''}`}>
                          <div className="text-[13px] font-semibold tracking-tight text-slate-700 dark:text-slate-300">
                            {typeof col.accessor === 'function' 
                              ? col.accessor(row) 
                              : (String(row[col.accessor]) || '-')}
                          </div>
                        </td>
                      ))}
                      {actions && (
                        <td className="px-5 py-2 text-right">
                          {actions(row)}
                        </td>
                      )}
                    </tr>

                    {isExpanded && renderExpandedRow && (
                      <tr className="bg-indigo-50/20 dark:bg-indigo-500/5">
                        <td
                          className="px-5 py-4"
                          colSpan={columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0)}
                        >
                          {renderExpandedRow(row)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-8 py-5 border-t transition-all bg-slate-50/50 border-slate-100 dark:bg-slate-950/40 dark:border-slate-800/50">
          <p className="text-[12px] font-semibold text-slate-400 tracking-wide">
            Showing <span className="text-slate-900 dark:text-white">{data.length}</span> of <span className="text-slate-900 dark:text-white">{totalDocs}</span> records
          </p>
          
          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1}
              onClick={() => onPageChange?.(page - 1)}
              className="p-2 rounded-lg transition-all border bg-white border-slate-200 text-slate-600 disabled:opacity-50 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:disabled:opacity-20"
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
                    className={`h-9 w-9 text-[11px] font-bold rounded-lg transition-all ${
                      page === pageNum 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                        : 'bg-white text-slate-500 hover:text-indigo-600 border border-slate-200 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:border-transparent'
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
              className="p-2 rounded-lg transition-all border bg-white border-slate-200 text-slate-600 disabled:opacity-50 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:disabled:opacity-20"
            >
              <FrameworkIcons.Right size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
