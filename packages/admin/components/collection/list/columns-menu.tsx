"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';

interface ColumnsMenuProps {
  theme: string;
  allColumns: any[];
  visibleColumnIds: string[];
  toggleColumn: (id: string) => void;
  reorderColumn: (id: string, direction: 'up' | 'down') => void;
}

export class CollectionColumnsMenu extends React.Component<ColumnsMenuProps> {
  render(): React.ReactNode {
    const { theme, allColumns, visibleColumnIds, toggleColumn, reorderColumn } = this.props;
    const isDark = theme === 'dark';
    const visibleColumns = visibleColumnIds.map((id) => allColumns.find((c) => c.id === id)).filter(Boolean);
    const hiddenColumns = allColumns.filter((c) => !visibleColumnIds.includes(c.id));
    return (
      <div
        className={`absolute right-0 mt-3 w-72 max-w-[92vw] rounded-2xl border shadow-2xl p-2 z-30 animate-in fade-in zoom-in duration-200 ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="px-2.5 py-2 mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500/80">
          Visible Columns
        </div>
        <div className="max-h-80 overflow-auto pr-1 space-y-0.5 custom-scrollbar">
          {visibleColumns.map((column: any, idx: number) => (
            <div
              key={column.id}
              className={`w-full px-2.5 py-2 rounded-xl flex items-center gap-2 ${
                isDark ? 'bg-indigo-500/10' : 'bg-indigo-50/60'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleColumn(column.id)}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div
                  className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                    isDark
                      ? 'bg-indigo-500 border-indigo-500 shadow-lg shadow-indigo-500/20'
                      : 'bg-indigo-600 border-indigo-600 shadow-sm shadow-indigo-600/20'
                  }`}
                >
                  <FrameworkIcons.Check size={11} className="text-white scale-110" strokeWidth={3} />
                </div>
                <span className={`text-xs font-bold truncate ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                  {column.header}
                </span>
              </button>
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  onClick={() => reorderColumn(column.id, 'up')}
                  disabled={idx === 0}
                  className={`p-0.5 rounded transition-colors ${
                    idx === 0
                      ? 'opacity-20 cursor-not-allowed'
                      : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <FrameworkIcons.ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => reorderColumn(column.id, 'down')}
                  disabled={idx === visibleColumns.length - 1}
                  className={`p-0.5 rounded transition-colors ${
                    idx === visibleColumns.length - 1
                      ? 'opacity-20 cursor-not-allowed'
                      : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <FrameworkIcons.ChevronDown size={12} />
                </button>
              </div>
            </div>
          ))}
          {hiddenColumns.length > 0 && (
            <>
              <div className="px-2.5 py-2 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500/80">
                Hidden
              </div>
              {hiddenColumns.map((column: any) => (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => toggleColumn(column.id)}
                  className={`w-full px-2.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-3 ${
                    isDark
                      ? 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div
                    className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'
                    }`}
                  />
                  <span className="truncate flex-1">{column.header}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }
}
