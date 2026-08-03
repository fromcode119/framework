import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type React from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { ActivityMode } from '@/app/activity/enums/activity-mode.enum';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';

export class ActivityDetailModal extends PureReactor {
  @prop declare selectedLog: any;
  @prop declare mode: ActivityMode;
  @prop declare theme: ThemeMode;
  @prop declare onClose: () => void;
  @prop declare onExport: (log: any) => void;

  @bound
  handleExport(): void {
    this.onExport(this.selectedLog);
  }

  render(): React.ReactNode {
    const { selectedLog, mode, theme, onClose } = this;
    return (
      <RootFramework>
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 lg:p-12 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />

          <div className={`w-full max-w-2xl max-h-[90vh] ${AdminClass.SURFACE} flex flex-col overflow-hidden relative transform animate-in zoom-in-95 slide-in-from-bottom-4 duration-500`}>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-semibold ${
                    selectedLog.level === 'ERROR' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' :
                    selectedLog.level === 'WARN' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                    'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  }`}>
                     {selectedLog.level[0]}
                  </div>
                  <div>
                    <h3 className={`text-xl font-semibold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
                      Event Details
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500 tracking-wide leading-none mt-1">
                      Log Signature: {selectedLog.id}
                    </p>
                  </div>
               </div>
               <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-900 dark:hover:text-white transition-colors">
                 <FrameworkIcons.Close size={20} />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
               <div className="grid grid-cols-2 gap-4">
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
                           <Badge variant={mode === ActivityMode.SECURITY ? (selectedLog.status === 'violation' ? 'danger' : 'blue') : 'blue'}>
                              {mode === ActivityMode.SYSTEM ? 'System Log' : `Audit: ${selectedLog.status}`}
                           </Badge>
                        </div>
                     </div>
                  </Card>
               </div>

               {mode === ActivityMode.SYSTEM ? (
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
                    <div className={`p-6 ${AdminClass.SURFACE} font-mono text-xs overflow-x-auto ${theme === ThemeMode.DARK ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-600'}`}>
                      <pre>{JSON.stringify(selectedLog.context || (typeof selectedLog.metadata === 'string' ? JSON.parse(selectedLog.metadata) : selectedLog.metadata), null, 2)}</pre>
                    </div>
                 </Card>
               )}
            </div>

            <div className={`p-8 border-t ${theme === ThemeMode.DARK ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
               <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-slate-400 tracking-wide italic">
                    This entry is part of an immutable audit trail.
                  </p>
                  <Button
                    variant={ButtonVariant.GHOST}
                    className="text-indigo-500 font-semibold text-[10px] tracking-wide"
                    icon={<FrameworkIcons.More size={14} />}
                    onClick={this.handleExport}
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
