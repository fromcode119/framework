import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type React from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';

export class RevisionModal extends PureReactor {
  @prop declare selectedRevision: any;
  @prop declare setSelectedRevision: (rev: any) => void;
  @prop declare showOnlyChanges: boolean;
  @prop declare setShowOnlyChanges: (val: boolean) => void;
  @prop declare formData: any;
  @prop declare setFormData: (data: any) => void;
  @prop declare theme: ThemeMode;
  @prop declare currentRevIndex: number;
  @prop declare revisions: any[];
  @prop declare restoringPermanently: boolean;
  @prop declare handleHardRestore: (version: number) => void;
  @prop declare setActiveVersionId: (id: number) => void;
  @prop declare setStatus: (status: { type: NotificationType, message: string } | null) => void;

  render(): React.ReactNode {
    const {
  selectedRevision,
  setSelectedRevision,
  showOnlyChanges,
  setShowOnlyChanges,
  formData,
  setFormData,
  theme,
  currentRevIndex,
  revisions,
  restoringPermanently,
  handleHardRestore,
  setActiveVersionId,
  setStatus
} = this;
  if (!selectedRevision) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
       <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setSelectedRevision(null)} />
       <Card className="relative w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
             <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-indigo-500">Version V{selectedRevision.version} Comparison</h2>
                <p className="text-[11px] text-slate-500 font-medium mt-1">{selectedRevision.date.toLocaleString()} by {selectedRevision.user}</p>
             </div>
             <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowOnlyChanges(!showOnlyChanges)}
                  className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg border transition-all ${showOnlyChanges ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                >
                  {showOnlyChanges ? 'Showing Changes' : 'Showing All Fields'}
                </button>
                <button onClick={() => setSelectedRevision(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <FrameworkIcons.Close size={20} />
                </button>
             </div>
          </div>

          <div className={`${AdminClass.SURFACE} ${theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} overflow-hidden`}>
             <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50">
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Current Values</div>
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-indigo-500">Version V{selectedRevision.version} Values</div>
             </div>
             <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                {Object.entries(selectedRevision.changes)
                  .filter(([key]) => {
                     if (['createdAt', 'updatedAt', 'id', 'created_at', 'updated_at'].includes(key)) return false;
                     if (showOnlyChanges) {
                        const curVal = formData[key];
                        const revVal = selectedRevision.changes[key];
                        return JSON.stringify(curVal) !== JSON.stringify(revVal);
                     }
                     return true;
                  })
                  .map(([key, val]) => {
                     const curVal = formData[key];
                     const hasChanged = JSON.stringify(curVal) !== JSON.stringify(val);
                     
                     return (
                      <div key={key} className={`grid grid-cols-2 group border-b border-slate-100 dark:border-slate-800 last:border-0 ${hasChanged ? 'bg-indigo-500/5' : ''}`}>
                         <div className="p-4 border-r border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{key}</span>
                            <div className="text-[11px] font-semibold text-slate-500 line-clamp-3">
                               {typeof curVal === 'object' ? JSON.stringify(curVal) : (curVal === undefined ? <span className="italic opacity-50">Empty</span> : String(curVal))}
                            </div>
                         </div>
                         <div className="p-4">
                            <span className="text-[10px] font-bold text-indigo-500 uppercase block mb-1">{key}</span>
                            <div className={`text-[11px] font-semibold line-clamp-3 ${hasChanged ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                               {typeof val === 'object' ? JSON.stringify(val) : (val === undefined ? <span className="italic opacity-50">Empty</span> : String(val))}
                            </div>
                         </div>
                      </div>
                     );
                  })}
                {showOnlyChanges && Object.entries(selectedRevision.changes).filter(([key]) => {
                     if (['createdAt', 'updatedAt', 'id', 'created_at', 'updated_at'].includes(key)) return false;
                     const curVal = formData[key];
                     const revVal = selectedRevision.changes[key];
                     return JSON.stringify(curVal) !== JSON.stringify(revVal);
                }).length === 0 && (
                  <div className="p-12 text-center">
                     <p className="text-xs text-slate-400 font-semibold italic">No changes detected between current state and this version.</p>
                  </div>
                )}
             </div>
          </div>

          <div className="flex items-center justify-between gap-4 mt-8">
             <div className="flex items-center gap-2">
                <Button 
                  variant={ButtonVariant.GHOST} 
                  className="text-[10px] font-bold uppercase tracking-wide disabled:opacity-30" 
                  disabled={currentRevIndex >= revisions.length - 1}
                  onClick={() => setSelectedRevision(revisions[currentRevIndex + 1])}
                >
                   <FrameworkIcons.Left size={12} className="mr-2" />
                   Older
                </Button>
                <Button 
                  variant={ButtonVariant.GHOST} 
                  className="text-[10px] font-bold uppercase tracking-wide disabled:opacity-30" 
                  disabled={currentRevIndex <= 0}
                  onClick={() => setSelectedRevision(revisions[currentRevIndex - 1])}
                >
                   Newer
                   <FrameworkIcons.Right size={12} className="ml-2" />
                </Button>
             </div>
             <div className="flex items-center gap-3">
                <Button 
                   variant={ButtonVariant.GHOST}
                   className="px-6 text-[10px] font-bold uppercase tracking-wide text-slate-500"
                   onClick={() => {
                      setFormData({ ...formData, ...selectedRevision.changes });
                      setActiveVersionId(selectedRevision.id);
                      setSelectedRevision(null);
                      setStatus({ type: NotificationType.SUCCESS, message: 'Revision applied to form. Click "Save Changes" to persist.' });
                   }}
                >
                   Preview in Form
                </Button>
                <Button 
                   className="px-8 text-[10px] font-bold uppercase tracking-wide shadow-lg shadow-indigo-500/30"
                   isLoading={restoringPermanently}
                   onClick={() => handleHardRestore(selectedRevision.version)}
                   icon={<FrameworkIcons.Refresh size={14} />}
                >
                   Restore Permanently
                </Button>
             </div>
          </div>
       </Card>
    </div>
  );
  }
}
