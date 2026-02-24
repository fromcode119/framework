"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@/lib/icons';

interface SidebarVersionsProps {
  revisions: any[];
  revisionsLoading: boolean;
  activeVersionId: number | null;
  setSelectedRevision: (rev: any) => void;
  setFormData: (data: any) => void;
  setActiveVersionId: (id: number) => void;
  loadMoreRevisions: () => void;
  hasMoreRevisions: boolean;
  formData: any;
}

export const SidebarVersions: React.FC<SidebarVersionsProps> = ({
  revisions,
  revisionsLoading,
  activeVersionId,
  setSelectedRevision,
  setFormData,
  setActiveVersionId,
  loadMoreRevisions,
  hasMoreRevisions,
  formData
}) => {
  return (
    <Card title="Version History">
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {revisions.length === 0 && !revisionsLoading && (
            <p className="text-[10px] text-slate-400 font-semibold italic py-2">No versions recorded yet.</p>
          )}
          {revisions.map((v, i) => (
            <div 
              key={i} 
              onClick={() => setSelectedRevision(v)}
              className={`flex items-start gap-3 group cursor-pointer p-2.5 -mx-2 rounded-xl transition-all border border-transparent ${v.id === activeVersionId ? 'bg-indigo-50/30 border-indigo-100/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <div className={`mt-1.5 h-1.5 w-1.5 rounded-full ${v.id === activeVersionId ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-300'} shrink-0`} />
              <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${v.id === activeVersionId ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>V{v.version}</span>
                        <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">{v.user}</span>
                    </div>
                    {v.id !== activeVersionId && (
                      <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setFormData({ ...formData, ...v.changes });
                            setActiveVersionId(v.id);
                          }}
                          className="text-[11px] font-semibold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0"
                      >
                          <FrameworkIcons.Refresh size={8} />
                          Restore
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{v.action}</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-1 opacity-60">{v.date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
            </div>
          ))}
          
          {revisionsLoading && (
            <div className="flex items-center justify-center py-4">
              <FrameworkIcons.Loader size={16} className="animate-spin text-indigo-500" />
            </div>
          )}

          {hasMoreRevisions && !revisionsLoading && (
            <button 
              onClick={loadMoreRevisions}
              className="w-full py-3 text-[10px] font-bold uppercase tracking-wide text-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-xl transition-all mt-2"
            >
              Load More History
            </button>
          )}
      </div>
    </Card>
  );
};
