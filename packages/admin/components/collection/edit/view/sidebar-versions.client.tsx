import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { VersionChangeSummary } from '@/components/collection/version-change-summary';

export class SidebarVersions extends PureReactor {
  @prop declare revisions: any[];
  @prop declare revisionsLoading: boolean;
  @prop declare activeVersionId: number | null;
  @prop declare setSelectedRevision: (rev: any) => void;
  @prop declare setFormData: (data: any) => void;
  @prop declare setActiveVersionId: (id: number) => void;
  @prop declare loadMoreRevisions: () => void;
  @prop declare hasMoreRevisions: boolean;
  @prop declare formData: any;
  /** The collection's fields, for the labels of what changed. */
  @prop declare fields: any[];

  /** What this version changed, from the version before it: a few "Field: before → after" lines. */
  private renderChanges(index: number): ReactNode {
    const older = this.revisions[index + 1];
    if (!older) {
      // The oldest version loaded: it is the creation when there is nothing further back, otherwise unknown until more is loaded.
      return this.hasMoreRevisions ? null : <p className="text-[11px] text-slate-500 mt-1">{AdminI18n.t('collection.edit.versionCreated')}</p>;
    }
    const changes = VersionChangeSummary.between(this.revisions[index].changes, older.changes, this.fields);
    if (!changes) return null;
    if (changes.length === 0) return <p className="text-[11px] text-slate-400 mt-1">{AdminI18n.t('collection.edit.versionNoFieldChanges')}</p>;
    const shown = changes.slice(0, 4);
    return (
      <ul className="mt-1 space-y-0.5">
        {shown.map((change) => (
          <li key={change.label} className="text-[11px] text-slate-600 dark:text-slate-300 break-words">
            <span className="font-semibold">{change.label}:</span>{' '}
            {change.from === change.to
              // Same text on both sides (a list of the same length, a long value cut short): it did change, and saying
              // "[1] → [1]" does not tell the operator so.
              ? <span>{AdminI18n.t('collection.edit.versionValueChanged')}</span>
              : <><span className="text-slate-400 line-through">{change.from}</span> → <span>{change.to}</span></>}
          </li>
        ))}
        {changes.length > shown.length && <li className="text-[11px] text-slate-400">{AdminI18n.t('collection.edit.versionMoreChanges', { count: changes.length - shown.length })}</li>}
      </ul>
    );
  }

  render(): ReactNode {
    const {
  revisions,
  revisionsLoading,
  activeVersionId,
  setSelectedRevision,
  setFormData,
  setActiveVersionId,
  loadMoreRevisions,
  hasMoreRevisions,
  formData
} = this;
  return (
    <Card title={AdminI18n.t('collection.edit.versions')}>
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {revisions.length === 0 && !revisionsLoading && (
            <p className="text-[10px] text-slate-400 font-semibold italic py-2">{AdminI18n.t('collection.edit.noVersions')}</p>
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
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg shrink-0 ${v.id === activeVersionId ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>V{v.version}</span>
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
                          {AdminI18n.t('collection.edit.restore')}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{v.action}</p>
                  {this.renderChanges(i)}
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
              {AdminI18n.t('collection.edit.loadMoreVersions')}
            </button>
          )}
      </div>
    </Card>
  );
  }
}
