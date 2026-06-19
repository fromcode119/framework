import React from 'react';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@fromcode119/react';
import type { Version, VersionHistoryListProps } from './version-history.interfaces';

export class VersionHistoryList extends React.Component<VersionHistoryListProps> {
  render(): React.ReactNode {
    const { revisions, loading, hasMore, activeVersionId, onSelect, onRestore, onLoadMore } = this.props;

    return (
      <Card title="Version History">
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {revisions.length === 0 && !loading && (
            <p className="text-xs text-slate-400 font-medium italic py-2">No versions recorded yet.</p>
          )}
          {revisions.map((v: Version, i: number) => (
            <div
              key={i}
              onClick={() => onSelect(v)}
              className={`flex items-start gap-3 group cursor-pointer p-2.5 -mx-2 rounded-xl transition-all border border-transparent ${v.id === activeVersionId ? 'bg-indigo-50/30 border-indigo-100/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
                <div className={`mt-1.5 h-1.5 w-1.5 rounded-full ${v.id === activeVersionId ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-300'} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[12px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${v.id === activeVersionId ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>v{v.version}</span>
                        <span className="text-xs font-semibold tracking-wide text-slate-900 dark:text-white truncate">{v.user}</span>
                      </div>
                      {v.id !== activeVersionId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestore(v.changes, v.id);
                          }}
                          className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0"
                        >
                          <FrameworkIcons.Refresh size={8} />
                          Restore
                        </button>
                      )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{v.action}</p>
                  <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-1 opacity-60">{v.date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center justify-center py-4">
                <FrameworkIcons.Loader size={16} className="animate-spin text-indigo-500" />
            </div>
          )}

          {hasMore && !loading && (
            <button
              onClick={onLoadMore}
              className="w-full py-3 text-[10px] font-semibold uppercase tracking-widest text-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-xl transition-all mt-2"
            >
              Load More History
            </button>
          )}
        </div>
      </Card>
    );
  }
}
