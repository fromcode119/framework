'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/components/theme-context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@/lib/icons';
import { DataTable } from '@/components/ui/data-table';
import { PageHeading } from '@/components/ui/page-heading';
import { api } from '@/lib/api';
import { ENDPOINTS, ROUTES } from '@/lib/constants';
import { RootFramework } from '@fromcode119/react';
import { AdminPageFooter } from '@/components/ui/admin-page-footer';

export default function ActivityPage() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<'system' | 'security'>('system');
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
    const modeParam = searchParams.get('mode');
    
    if (userFilter && !searchQuery) {
      setSearchQuery(userFilter);
      setActiveSearch(userFilter);
    }
    
    if (modeParam === 'security') {
      setMode('security');
    }
  }, []);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      try {
        const endpoint = mode === 'system' ? ENDPOINTS.SYSTEM.LOGS : ENDPOINTS.SYSTEM.AUDIT;
        const response = await api.get(`${endpoint}?page=${page}&limit=${limit}&search=${activeSearch}`);
        setLogs(response.docs || []);
        setTotalDocs(response.totalDocs || 0);
      } catch (error) {
        console.error(`Failed to fetch ${mode} logs:`, error);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [page, activeSearch, mode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchQuery);
  };

  const handleExportJSON = (log: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(log, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `log-${log.id || 'export'}-${new Date().getTime()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const systemColumns = useMemo(() => [
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
            <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-semibold w-fit tracking-tighter ${levelStyle}`}>
               {row.level}
            </span>
            <span className="text-[9px] font-semibold text-slate-400 tracking-wide pl-1">
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
        const actor = row.actor_id || row.context?.email || (row.message && row.message.includes('for ') ? row.message.split('for ')[1] : 'SYSTEM');
        return (
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}>
              {actor[0].toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-slate-600 dark:text-white tracking-tight leading-none">{actor}</span>
              <span className="text-[10px] font-semibold text-slate-400 mt-1 tracking-tight">
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
          <span className="font-semibold text-[11px] text-slate-500 tracking-wide">{row.plugin_slug ? (row.plugin_slug.charAt(0).toUpperCase() + row.plugin_slug.slice(1)) : 'System'}</span>
        </div>
      )
    },
    {
      header: 'Timestamp',
      id: 'timestamp',
      accessor: (row: any) => (
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
             {new Date(row.timestamp || row.createdAt).toLocaleTimeString()}
          </span>
          <span className="text-[8px] font-semibold text-slate-400 tracking-wide mt-0.5 italic">
             {new Date(row.timestamp || row.createdAt).toLocaleDateString()}
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

  const securityColumns = useMemo(() => [
    {
      header: 'Status',
      id: 'status',
      accessor: (row: any) => {
        const style = row.status === 'violation' 
          ? (theme === 'dark' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-700')
          : row.status === 'denied'
          ? (theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-700')
          : (theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700');

        return (
          <div className="flex flex-col gap-1">
            <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-semibold w-fit tracking-tighter ${style}`}>
               {row.status}
            </span>
          </div>
        );
      }
    },
    {
      header: 'plugin',
      id: 'plugin',
      accessor: (row: any) => (
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 text-[10px] font-semibold">
             {row.plugin_slug ? row.plugin_slug[0].toUpperCase() : 'S'}
          </div>
          <span className="font-semibold text-[11px] text-slate-600 dark:text-slate-200 tracking-wide">{row.plugin_slug ? (row.plugin_slug.charAt(0).toUpperCase() + row.plugin_slug.slice(1)) : 'System'}</span>
        </div>
      )
    },
    {
      header: 'Action',
      id: 'action',
      accessor: (row: any) => (
        <div className="flex flex-col">
           <span className="text-xs font-semibold text-slate-700 dark:text-white tracking-tight">{row.action}</span>
           <span className="text-[10px] font-medium text-slate-400 mt-0.5">{row.resource}</span>
        </div>
      )
    },
    {
      header: 'Time',
      id: 'timestamp',
      accessor: (row: any) => (
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
             {new Date(row.createdAt).toLocaleTimeString()}
          </span>
          <span className="text-[8px] font-semibold text-slate-400 tracking-wide mt-0.5 italic">
             {new Date(row.createdAt).toLocaleDateString()}
          </span>
        </div>
      )
    }
  ], [theme]);

  const columns = mode === 'system' ? systemColumns : securityColumns;

  return (
    <div className="w-full pb-24 animate-in fade-in duration-500">
      {/* Activity Header */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)]'
      }`}>
        <div className="w-full px-6 lg:px-12 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
              <PageHeading
                icon={
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 transition-transform hover:rotate-0 ${
                    theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-600 text-white'
                  }`}>
                    <FrameworkIcons.Activity size={20} strokeWidth={2.5} />
                  </div>
                }
                title={mode === 'system' ? 'System Activity' : 'Security Audit'}
                subtitle="Global ledger of administrative actions and security events."
                titleClassName="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none italic"
                subtitleClassName="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-tight opacity-80 mt-2"
              />

              <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
                 <button 
                  onClick={() => { setMode('system'); setPage(1); }}
                  className={`px-6 py-2 rounded-xl text-[10px] font-semibold tracking-wide transition-all ${
                    mode === 'system' 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                 >
                   System Events
                 </button>
                 <button 
                  onClick={() => { setMode('security'); setPage(1); }}
                  className={`px-6 py-2 rounded-xl text-[10px] font-semibold tracking-wide transition-all ${
                    mode === 'security' 
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                 >
                   Security Audit
                 </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder={`Search ${mode} logs...`} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`px-4 py-2.5 rounded-xl border text-[13px] font-medium outline-none transition-all w-64 ${
                    theme === 'dark' 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' 
                      : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm'
                  }`}
                />
                <Button 
                  type="submit"
                  variant="secondary"
                  size="md" 
                  className="px-6 rounded-xl font-semibold tracking-wide text-[11px]"
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
                 <button onClick={() => setSelectedLog(null)} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
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

      <AdminPageFooter
        label="System Activity Log"
        description="Global ledger of administrative actions and system events."
        accent="emerald"
        links={[
          { label: 'Users', href: ROUTES.USERS.LIST },
          { label: 'Roles', href: ROUTES.USERS.ROLE_LIST },
          { label: 'Permissions', href: ROUTES.USERS.PERMISSIONS },
        ]}
      />
    </div>
  );
}
