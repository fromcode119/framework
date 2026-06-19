"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { DataTablePagination } from './data-table-pagination';
import type { Column, DataTableProps } from './data-table.interfaces';

/** Generic paginated, sortable, selectable data table. Pure presentational class. */
export class DataTable<T extends { id: any }> extends React.Component<DataTableProps<T>> {
  private handleSort(columnId: string): void {
    const { onSort, currentSort } = this.props;
    if (!onSort) return;
    const isDesc = currentSort === `-${columnId}`;
    onSort(isDesc ? columnId : `-${columnId}`);
  }

  private toggleAll(): void {
    const { onSelectionChange, selectedIds = [], data } = this.props;
    if (!onSelectionChange) return;
    if (selectedIds.length === data.length) onSelectionChange([]);
    else onSelectionChange(data.map(row => String(row.id)));
  }

  private toggleOne(id: string, e: React.MouseEvent): void {
    e.stopPropagation();
    const { onSelectionChange, selectedIds = [] } = this.props;
    if (!onSelectionChange) return;
    const stringId = String(id);
    if (selectedIds.includes(stringId)) onSelectionChange(selectedIds.filter(i => i !== stringId));
    else onSelectionChange([...selectedIds, stringId]);
  }

  private getSortIcon(columnId: string): React.ReactNode {
    const { currentSort } = this.props;
    if (currentSort === columnId) return <FrameworkIcons.Up size={12} />;
    if (currentSort === `-${columnId}`) return <FrameworkIcons.Down size={12} />;
    return <FrameworkIcons.Down size={12} className="opacity-20" />;
  }

  render(): React.ReactNode {
    const {
      columns, data, loading, totalDocs = 0, limit = 10, page = 1,
      onPageChange, onRowClick, actions, emptyMessage = 'No records found',
      selectable, selectedIds = [], expandedRowId = null, renderExpandedRow, groupBy,
    } = this.props;
    const totalColumns = columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0);
    const groupCounts: Record<string, number> = {};
    if (groupBy) for (const row of data) { const k = groupBy(row) || '—'; groupCounts[k] = (groupCounts[k] || 0) + 1; }

    return (
      <div className={`flex flex-col w-full h-full transition-all duration-300 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-100/50 border-b border-slate-200/60 dark:bg-slate-900/50 dark:border-slate-800">
                {selectable && (
                  <th className="px-5 py-4 w-4">
                    <div
                      onClick={() => this.toggleAll()}
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
                    onClick={() => col.sortable && this.handleSort(col.id)}
                  >
                    <div className="flex items-center gap-2">
                      {col.header}
                      {col.sortable && this.getSortIcon(col.id)}
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
                  const groupKey = groupBy ? (groupBy(row) || '—') : null;
                  const showGroupHeader = groupKey !== null && (index === 0 || groupKey !== (groupBy!(data[index - 1]) || '—'));
                  return (
                    <React.Fragment key={rowKey}>
                      {showGroupHeader && (
                        <tr className="bg-slate-50 dark:bg-slate-900/60 border-y border-slate-200/60 dark:border-slate-800">
                          <td colSpan={totalColumns} className="px-5 py-2.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{groupKey}</span>
                            <span className="ml-2 text-[11px] font-semibold text-slate-400">{groupCounts[groupKey!]}</span>
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`transition-all duration-200 cursor-default hover:bg-slate-50/80 dark:hover:bg-slate-800/30 ${onRowClick ? 'cursor-pointer' : ''} ${selectedIds.includes(String(row.id)) ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : ''}`}
                        onClick={() => onRowClick?.(row)}
                      >
                        {selectable && (
                          <td className="px-5 py-3 w-4" onClick={(e) => this.toggleOne(String(row.id), e)}>
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
                          <td className="px-5 py-2 text-right">{actions(row)}</td>
                        )}
                      </tr>
                      {isExpanded && renderExpandedRow && (
                        <tr className="bg-indigo-50/20 dark:bg-indigo-500/5">
                          <td className="px-5 py-4" colSpan={columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0)}>
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

        <DataTablePagination
          totalDocs={totalDocs}
          limit={limit}
          page={page}
          onPageChange={onPageChange}
        />
      </div>
    );
  }
}
