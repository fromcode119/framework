"use client";

import React from 'react';
import { FrameworkIcons } from '../../../lib/icons';
import { Button } from '../../../components/ui/button';

interface BulkActionsProps {
  theme: string;
  selectedIds: string[];
  statusOptions: { label: string; value: string }[];
  handleBulkStatusChange: (status: string) => void;
  handleExport: (format: 'json' | 'csv', ids?: string[]) => void;
  handleBulkDelete: () => void;
  setSelectedIds: (ids: string[]) => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  theme,
  selectedIds,
  statusOptions,
  handleBulkStatusChange,
  handleExport,
  handleBulkDelete,
  setSelectedIds
}) => {
  if (selectedIds.length === 0) return null;

  return (
    <div className={`flex items-center flex-wrap gap-1 p-1 rounded-2xl animate-in slide-in-from-top-2 duration-300 border shadow-sm ${
      theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
    }`}>
      <div className="px-3 py-2 text-xs font-bold tracking-tight text-indigo-500 border-r border-slate-200 dark:border-slate-800 mr-1">
        {selectedIds.length} Selected
      </div>
      
      {statusOptions.length > 0 && (
        <>
          <div className="flex items-center gap-1 group/bulk">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleBulkStatusChange(option.value)}
                className={`h-11 px-3 text-[11px] font-bold tracking-tight rounded-xl transition-all ${
                  theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-white text-slate-500 hover:text-indigo-600'
                }`}
              >
                Set {option.label || option.value}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
        </>
      )}

      <Button 
        variant="secondary" 
        size="sm" 
        className="rounded-xl h-11 px-4 text-[12px] font-bold tracking-tight"
        icon={<FrameworkIcons.Download size={14} />}
        onClick={() => handleExport('json', selectedIds)}
      >
        Export
      </Button>
      <Button 
        variant="secondary" 
        size="sm" 
        className="rounded-xl h-11 px-4 text-[12px] font-bold tracking-tight text-rose-500 hover:text-rose-600"
        icon={<FrameworkIcons.Trash size={14} />}
        onClick={handleBulkDelete}
      >
        Delete
      </Button>
      <button 
        onClick={() => setSelectedIds([])}
        className="h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        title="Clear selection"
      >
        <FrameworkIcons.Close size={16} />
      </button>
    </div>
  );
};
