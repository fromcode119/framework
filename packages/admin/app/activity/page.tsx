'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { DataTable } from '@/components/ui/data-table';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AdminPageFooter } from '@/components/ui/admin-page-footer';
import { ActivityColumnsFactory } from './activity-columns';
import { ActivityPageHeader } from './activity-page-header';
import { ActivityDetailModal } from './activity-detail-modal';

export default function ActivityPage() {
  const { theme } = ThemeHooks.useTheme();
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
        const endpoint = mode === 'system' ? AdminConstants.ENDPOINTS.SYSTEM.LOGS : AdminConstants.ENDPOINTS.SYSTEM.AUDIT;
        const response = await AdminApi.get(`${endpoint}?page=${page}&limit=${limit}&search=${activeSearch}`);
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

  const systemColumns = useMemo(() => ActivityColumnsFactory.system(theme), [theme]);
  const securityColumns = useMemo(() => ActivityColumnsFactory.security(theme), [theme]);
  const columns = mode === 'system' ? systemColumns : securityColumns;

  return (
    <div className="w-full pb-24 animate-in fade-in duration-500">
      <ActivityPageHeader
        mode={mode}
        theme={theme}
        searchQuery={searchQuery}
        onModeChange={(nextMode) => { setMode(nextMode); setPage(1); }}
        onSearchQueryChange={setSearchQuery}
        onSearch={handleSearch}
      />

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
        <ActivityDetailModal
          selectedLog={selectedLog}
          mode={mode}
          theme={theme}
          onClose={() => setSelectedLog(null)}
          onExport={handleExportJSON}
        />
      )}

      <AdminPageFooter
        label="System Activity Log"
        description="Global ledger of administrative actions and system events."
        accent="emerald"
        links={[
          { label: 'Users', href: AdminConstants.ROUTES.USERS.LIST },
          { label: 'Roles', href: AdminConstants.ROUTES.USERS.ROLE_LIST },
          { label: 'Permissions', href: AdminConstants.ROUTES.USERS.PERMISSIONS },
        ]}
      />
    </div>
  );
}
