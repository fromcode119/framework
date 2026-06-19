import React from 'react';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/button';
import type { VersionRevisionModalProps } from './version-history.interfaces';

export class VersionRevisionModal extends React.Component<VersionRevisionModalProps> {
  render(): React.ReactNode {
    const { selectedRevision, revisions, currentRevIndex, theme, onSelect, onRestore } = this.props;

    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
         <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => onSelect(null)} />
         <Card className="relative w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
               <div>
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Revision Details</h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">{selectedRevision.date.toLocaleString()} by {selectedRevision.user}</p>
               </div>
               <button onClick={() => onSelect(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  <FrameworkIcons.Close size={20} />
               </button>
            </div>

            <div className={`rounded-xl p-4 mb-6 max-h-[40vh] overflow-y-auto ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
               <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Snapshot Changes</h3>
               <div className="space-y-3">
                  {Object.entries(selectedRevision.changes)
                    .filter(([key]) => !['createdAt', 'updatedAt', 'id', 'created_at', 'updated_at'].includes(key))
                    .map(([key, val]) => (
                     <div key={key} className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0">
                        <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">{key}</span>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                     </div>
                  ))}
               </div>
            </div>

            <div className="flex items-center justify-between gap-4 mt-8">
               <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="text-[10px] font-semibold uppercase tracking-widest disabled:opacity-30"
                    disabled={currentRevIndex >= revisions.length - 1}
                    onClick={() => onSelect(revisions[currentRevIndex + 1])}
                  >
                     <FrameworkIcons.Left size={14} className="mr-2" />
                     Older
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-[10px] font-semibold uppercase tracking-widest disabled:opacity-30"
                    disabled={currentRevIndex <= 0}
                    onClick={() => onSelect(revisions[currentRevIndex - 1])}
                  >
                     Newer
                     <FrameworkIcons.Right size={14} className="ml-2" />
                  </Button>
               </div>
               <Button
                  className="px-8 text-[10px] font-semibold uppercase tracking-widest"
                  onClick={() => {
                     onRestore(selectedRevision.changes, selectedRevision.id);
                     onSelect(null);
                  }}
               >
                  Apply Revision
               </Button>
            </div>
         </Card>
      </div>
    );
  }
}
