import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@fromcode119/react';
import type { ActivityDetailModalProps } from './activity-page.interfaces';

export class ActivityDetailModal extends React.Component<ActivityDetailModalProps> {
  render(): React.ReactNode {
    const { selectedLog, mode, theme, onClose, onExport } = this.props;
    return (
      <RootFramework>
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 lg:p-12 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />

          <div className={`w-full max-w-2xl max-h-[90vh] rounded-[3rem] shadow-2xl border flex flex-col overflow-hidden relative transform animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 ${
            theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="p-8 border-b flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-semibold ${
                    selectedLog.level === 'ERROR' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' :
                    selectedLog.level === 'WARN' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                    'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  }`}>
                     {selectedLog.level[0]}
                  </div>
                  <div>
                    <h3 className={`text-xl font-semibold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Event Details
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500 tracking-wide leading-none mt-1">
                      Log Signature: {selectedLog.id}
                    </p>
                  </div>
               </div>
               <button onClick={onClose} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                 <FrameworkIcons.Close size={24} />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
               <div className="grid grid-cols-2 gap-6">
                  <Card title="Context">
                     <div className="space-y-4">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-semibold tracking-wide text-slate-400 mb-1">Resource</span>
                           <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{selectedLog.plugin_slug ? (selectedLog.plugin_slug.charAt(0).toUpperCase() + selectedLog.plugin_slug.slice(1)) : 'System'}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[10px] font-semibold tracking-wide text-slate-400 mb-1">Timestamp</span>
                           <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                             {new Date(selectedLog.timestamp || selectedLog.createdAt).toLocaleString()}
                           </span>
                        </div>
                     </div>
                  </Card>
                  <Card title="Authority">
                     <div className="space-y-4">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-semibold tracking-wide text-slate-400 mb-1">Actor ID</span>
                           <span className="text-[13px] font-semibold text-indigo-500">{selectedLog.actor_id || 'System'}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[10px] font-semibold tracking-wide text-slate-400 mb-1">Type</span>
                           <Badge variant={mode === 'security' ? (selectedLog.status === 'violation' ? 'danger' : 'blue') : 'blue'}>
                              {mode === 'system' ? 'System Log' : `Audit: ${selectedLog.status}`}
                           </Badge>
                        </div>
                     </div>
                  </Card>
               </div>

               {mode === 'system' ? (
                  <Card title="Activity Message">
                      <p className="text-[13px] font-medium text-slate-500 leading-relaxed italic">
                      "{selectedLog.message}"
                      </p>
                  </Card>
               ) : (
                  <div className="grid grid-cols-2 gap-4">
                      <Card title="Action Taken">
                          <span className="text-[13px] font-bold text-slate-900 dark:text-white">{selectedLog.action}</span>
                      </Card>
                      <Card title="Resource Pool">
                          <span className="text-[13px] font-mono text-slate-500">{selectedLog.resource}</span>
                      </Card>
                  </div>
               )}

               {(selectedLog.context || selectedLog.metadata) && (
                 <Card title="Raw Metadata" className="overflow-hidden">
                    <div className={`p-6 rounded-2xl font-mono text-xs overflow-x-auto ${theme === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-600'}`}>
                      <pre>{JSON.stringify(selectedLog.context || (typeof selectedLog.metadata === 'string' ? JSON.parse(selectedLog.metadata) : selectedLog.metadata), null, 2)}</pre>
                    </div>
                 </Card>
               )}
            </div>

            <div className={`p-8 border-t ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
               <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-slate-400 tracking-wide italic">
                    This entry is part of an immutable audit trail.
                  </p>
                  <Button
                    variant="ghost"
                    className="text-indigo-500 font-semibold text-[10px] tracking-wide"
                    icon={<FrameworkIcons.More size={14} />}
                    onClick={() => onExport(selectedLog)}
                  >
                     Export JSON
                  </Button>
               </div>
            </div>
          </div>
        </div>
      </RootFramework>
    );
  }
}
