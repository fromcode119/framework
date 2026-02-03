'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FrameworkIcons } from '@/lib/icons';
import { DataTable } from '@/components/ui/DataTable';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { RootFramework } from '@fromcode/react';
import Link from 'next/link';

export default function ActivityPage() {
  const { theme } = useTheme();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const limit = 50;

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const userFilter = searchParams.get('user');
    if (userFilter && !searchQuery) {
      setSearchQuery(userFilter);
      setActiveSearch(userFilter);
    }
  }, []);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      try {
        const response = await api.get(`${ENDPOINTS.SYSTEM.LOGS}?page=${page}&limit=${limit}&search=${activeSearch}`);
        setLogs(response.docs || []);
        setTotalDocs(response.totalDocs || 0);
      } catch (error) {
        console.error('Failed to fetch audit logs:', error);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [page, activeSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchQuery);
  };

  const handleExportJSON = (log: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(log, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `log-${log.id}-${new Date().getTime()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const columns = useMemo(() => [
    {
      header: 'Event',
      id: 'event',
      accessor: (row: any) => {
        const levelStyle = row.level === 'ERROR' 
          ? (theme === 'dark' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-700')
          : row.level === 'WARN'
          ? (theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-700')
          : (theme === 'dark' ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700');

        return (
          <div className="flex flex-col gap-1">
            <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-black w-fit uppercase tracking-tighter ${levelStyle}`}>
               {row.level}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">
              {String(row.id).includes('-') ? row.id.split('-')[0] : `LOG-${row.id}`}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Actor',
      id: 'actor',
      accessor: (row: any) => {
        const actor = row.actor_id || row.context?.email || (row.message.includes('for ') ? row.message.split('for ')[1] : 'SYSTEM');
        return (
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}>
              {actor[0].toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-600 dark:text-white tracking-tight leading-none">{actor}</span>
              <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                {row.actor_id ? `ID: ${row.actor_id}` : (row.context?.userId ? `UID: ${row.context.userId}` : 'INTERNAL')}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Resource',
      id: 'target',
      accessor: (row: any) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-500/60 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
          <span className="font-bold text-[11px] text-slate-500 uppercase tracking-[0.1em]">{row.plugin_slug || 'CORE'}</span>
        </div>
      )
    },
    {
      header: 'Timestamp',
      id: 'timestamp',
      accessor: (row: any) => (
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase">
             {new Date(row.timestamp).toLocaleTimeString()}
          </span>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5 italic">
             {new Date(row.timestamp).toLocaleDateString()}
          </span>
        </div>
      )
    },
    {
      header: 'Activity',
      id: 'details',
      accessor: (row: any) => (
        <span className="text-xs font-medium text-slate-500 leading-relaxed block max-w-sm">{row.message}</span>
      )
    }
  ], [theme]);

  return (
    <div className="w-full pb-24 animate-in fade-in duration-500">
      {/* Premium Activity Header */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)]'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center shadow-lg transform rotate-3 transition-transform hover:rotate-0 ${
                  theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-600 text-white'
                }`}>
                  <FrameworkIcons.Check size={22} strokeWidth={2.5} />
                </div>
                <h1 className={`text-3xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  System Activity
                </h1>
              </div>
              <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
                Tracking user actions and system events across all plugins and core modules.
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="Search activity..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all w-64 ${
                    theme === 'dark' 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' 
                      : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm'
                  }`}
                />
                <Button 
                  type="submit"
                  variant="secondary"
                  size="sm" 
                  className="px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px]"
                  icon={<FrameworkIcons.Search size={16} />}
                >
                  Filter history
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-12 pt-12 space-y-8 pb-12">
        <div className={`rounded-[2.5rem] border overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none ${
          theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200/60'
        }`}>
          <DataTable
            columns={columns}
            data={logs}
            totalDocs={totalDocs}
            limit={limit}
            page={page}
            onPageChange={setPage}
            onRowClick={(log) => setSelectedLog(log)}
            emptyMessage={loading ? "Decrypting audit ledger..." : "No audit records documented"}
          />
        </div>
      </div>

      {selectedLog && (
        <RootFramework>
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 lg:p-12 animate-in fade-in duration-300">
             <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setSelectedLog(null)} />
           
            <div className={`w-full max-w-2xl max-h-[90vh] rounded-[3rem] shadow-2xl border flex flex-col overflow-hidden relative transform animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 ${
              theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="p-8 border-b flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black ${
                      selectedLog.level === 'ERROR' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' :
                      selectedLog.level === 'WARN' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                      'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    }`}>
                       {selectedLog.level[0]}
                    </div>
                    <div>
                      <h3 className={`text-xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        Event Details
                      </h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">
                        Log Signature: {selectedLog.id}
                      </p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedLog(null)} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                   <FrameworkIcons.Close size={24} />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                 <div className="grid grid-cols-2 gap-6">
                    <Card title="Context">
                       <div className="space-y-4">
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Resource</span>
                             <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{selectedLog.plugin_slug || 'Core System'}</span>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Timestamp</span>
                             <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                               {new Date(selectedLog.timestamp).toLocaleString()}
                             </span>
                          </div>
                       </div>
                    </Card>
                    <Card title="Authority">
                       <div className="space-y-4">
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Actor ID</span>
                             <span className="text-sm font-bold text-indigo-500">{selectedLog.actor_id || 'System'}</span>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Privilege</span>
                             <Badge variant="blue">Root / Admin</Badge>
                          </div>
                       </div>
                    </Card>
                 </div>

                 <Card title="Activity Message">
                    <p className="text-sm font-medium text-slate-500 leading-relaxed italic">
                      "{selectedLog.message}"
                    </p>
                 </Card>

                 {selectedLog.context && (
                   <Card title="Raw Metadata" className="overflow-hidden">
                      <div className={`p-6 rounded-2xl font-mono text-xs overflow-x-auto ${theme === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-600'}`}>
                        <pre>{JSON.stringify(selectedLog.context, null, 2)}</pre>
                      </div>
                   </Card>
                 )}
              </div>

              <div className={`p-8 border-t ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                 <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                      This entry is part of an immutable audit trail.
                    </p>
                    <Button 
                      variant="ghost" 
                      className="text-indigo-500 font-black text-[10px] uppercase tracking-widest" 
                      icon={<FrameworkIcons.More size={14} />}
                      onClick={() => handleExportJSON(selectedLog)}
                    >
                       Export JSON
                    </Button>
                 </div>
              </div>
            </div>
          </div>
        </RootFramework>
      )}

      {/* Premium Footer */}
      <div className={`p-10 border-t mt-auto ${
        theme === 'dark' ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="w-full px-6 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  System Activity Log
                </span>
              </div>
              <p className="text-[9px] font-bold text-slate-400">Global ledger of administrative actions and system events.</p>
            </div>
            
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
               <Link href="/users" className="hover:text-indigo-500 transition-colors">Users</Link>
               <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-800" />
               <Link href="/users/roles" className="hover:text-indigo-500 transition-colors">Roles</Link>
               <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-800" />
               <Link href="/users/permissions" className="hover:text-indigo-500 transition-colors">Permissions</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
