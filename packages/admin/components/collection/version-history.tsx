import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { FrameworkIcons } from '../../lib/icons';
import { api } from '../../lib/api';
import { ENDPOINTS } from '../../lib/constants';
import { Button } from '../../components/ui/button';

interface Version {
  id: number;
  version: number;
  date: Date;
  user: string;
  action: string;
  changes: any;
}

interface VersionHistoryProps {
  collectionSlug: string;
  recordId: string;
  onRestore: (data: any, versionId: number) => void;
  activeVersionId: number | null;
  theme: string;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  collectionSlug,
  recordId,
  onRestore,
  activeVersionId,
  theme
}) => {
  const [revisions, setRevisions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedRevision, setSelectedRevision] = useState<Version | null>(null);

  const fetchRevisions = async (p: number) => {
    setLoading(true);
    try {
      const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/versions?ref_id=${recordId}&ref_collection=${collectionSlug}&sort=-id&limit=10&page=${p}`);
      
      const mapped: Version[] = (result.docs || []).map((v: any) => ({
        id: v.id,
        version: v.version || 1,
        date: new Date(v.created_at || v.createdAt),
        user: v.updated_by || v.updatedBy || 'System',
        action: v.change_summary || 'Update',
        changes: v.version_data
      }));

      if (p === 1) {
        setRevisions(mapped);
      } else {
        setRevisions(prev => [...prev, ...mapped]);
      }
      
      setHasMore(result.hasNextPage || (result.docs?.length === 10));
    } catch (err) {
      console.error("Failed to fetch revisions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (recordId && collectionSlug) {
      fetchRevisions(1);
    }
  }, [recordId, collectionSlug]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRevisions(nextPage);
  };

  const currentRevIndex = selectedRevision ? revisions.findIndex(r => r.id === selectedRevision.id) : -1;

  return (
    <>
      <Card title="Version History">
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {revisions.length === 0 && !loading && (
            <p className="text-xs text-slate-400 font-medium italic py-2">No versions recorded yet.</p>
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
              onClick={loadMore}
              className="w-full py-3 text-[10px] font-semibold uppercase tracking-widest text-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-xl transition-all mt-2"
            >
              Load More History
            </button>
          )}
        </div>
      </Card>

      {selectedRevision && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setSelectedRevision(null)} />
           <Card className="relative w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Revision Details</h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">{selectedRevision.date.toLocaleString()} by {selectedRevision.user}</p>
                 </div>
                 <button onClick={() => setSelectedRevision(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
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
                      onClick={() => setSelectedRevision(revisions[currentRevIndex + 1])}
                    >
                       <FrameworkIcons.Left size={14} className="mr-2" />
                       Older
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="text-[10px] font-semibold uppercase tracking-widest disabled:opacity-30" 
                      disabled={currentRevIndex <= 0}
                      onClick={() => setSelectedRevision(revisions[currentRevIndex - 1])}
                    >
                       Newer
                       <FrameworkIcons.Right size={14} className="ml-2" />
                    </Button>
                 </div>
                 <Button 
                    className="px-8 text-[10px] font-semibold uppercase tracking-widest"
                    onClick={() => {
                       onRestore(selectedRevision.changes, selectedRevision.id);
                       setSelectedRevision(null);
                    }}
                 >
                    Apply Revision
                 </Button>
              </div>
           </Card>
        </div>
      )}
    </>
  );
};
