import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type React from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Dialog } from '@/components/ui/view/dialog.client';
import { DialogSize } from '@/components/ui/enums/dialog-size.enum';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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

  /** Moving between versions on the left; what to do with this one on the right. */
  private get foot(): React.ReactNode {
    const { selectedRevision, setSelectedRevision, currentRevIndex, revisions, formData, setFormData,
      setActiveVersionId, setStatus, restoringPermanently, handleHardRestore } = this;
    return (
      <>
        <Button
          variant={ButtonVariant.GHOST}
          disabled={currentRevIndex >= revisions.length - 1}
          onClick={() => setSelectedRevision(revisions[currentRevIndex + 1])}
          icon={<FrameworkIcons.Left size={14} />}
        >
          {AdminI18n.t('collection.revision.older')}
        </Button>
        <Button
          variant={ButtonVariant.GHOST}
          disabled={currentRevIndex <= 0}
          onClick={() => setSelectedRevision(revisions[currentRevIndex - 1])}
        >
          {AdminI18n.t('collection.revision.newer')}
        </Button>
        <Button
          variant={ButtonVariant.GHOST}
          onClick={() => {
            setFormData({ ...formData, ...selectedRevision.changes });
            setActiveVersionId(selectedRevision.id);
            setSelectedRevision(null);
            setStatus({ type: NotificationType.SUCCESS, message: AdminI18n.t('collection.revision.applied') });
          }}
        >
          {AdminI18n.t('collection.revision.previewInForm')}
        </Button>
        <Button
          isLoading={restoringPermanently}
          onClick={() => handleHardRestore(selectedRevision.version)}
          icon={<FrameworkIcons.Refresh size={14} />}
        >
          {AdminI18n.t('collection.revision.restorePermanently')}
        </Button>
      </>
    );
  }

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
    <Dialog
      isOpen
      onClose={() => setSelectedRevision(null)}
      title={AdminI18n.t('collection.revision.title', { version: selectedRevision.version })}
      description={AdminI18n.t('collection.revision.meta', { date: selectedRevision.date.toLocaleString(), user: selectedRevision.user })}
      icon={<FrameworkIcons.Refresh size={18} />}
      size={DialogSize.LARGE}
      busy={restoringPermanently}
      foot={this.foot}
    >
          <div className="fc-revision__filter">
                <Button
                  variant={showOnlyChanges ? ButtonVariant.PRIMARY : ButtonVariant.GHOST}
                  onClick={() => setShowOnlyChanges(!showOnlyChanges)}
                >
                  {AdminI18n.t(showOnlyChanges ? 'collection.revision.onlyChanges' : 'collection.revision.allFields')}
                </Button>
          </div>

          <div className={`${AdminClass.SURFACE} ${theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} overflow-hidden`}>
             <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50">
                <div className="px-4 py-2 text-[12px] font-medium text-slate-400">{AdminI18n.t('collection.revision.current')}</div>
                <div className="px-4 py-2 text-[12px] font-medium text-indigo-500">{AdminI18n.t('collection.revision.versionValues', { version: selectedRevision.version })}</div>
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
                         <div className="p-4 border-e border-slate-100 dark:border-slate-800">
                            <span className="text-[12px] font-medium text-slate-400 block mb-1">{key}</span>
                            <div className="text-[12px] font-medium text-slate-500 line-clamp-3">
                               {typeof curVal === 'object' ? JSON.stringify(curVal) : (curVal === undefined ? <span className="italic opacity-50">{AdminI18n.t('collection.revision.empty')}</span> : String(curVal))}
                            </div>
                         </div>
                         <div className="p-4">
                            <span className="text-[12px] font-medium text-indigo-500 block mb-1">{key}</span>
                            <div className={`text-[12px] font-medium line-clamp-3 ${hasChanged ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                               {typeof val === 'object' ? JSON.stringify(val) : (val === undefined ? <span className="italic opacity-50">{AdminI18n.t('collection.revision.empty')}</span> : String(val))}
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
                     <p className="text-xs text-slate-400 font-medium italic">{AdminI18n.t('collection.revision.noChanges')}</p>
                  </div>
                )}
             </div>
          </div>

    </Dialog>
  );
  }
}
