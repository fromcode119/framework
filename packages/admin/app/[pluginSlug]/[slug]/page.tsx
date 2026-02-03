"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Slot, usePlugins } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FrameworkIcons } from '@/lib/icons';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';

export default function CollectionListPage() {
  const { pluginSlug, slug } = useParams() as { pluginSlug: string; slug: string };
  const { collections, settings } = usePlugins();
  const { theme } = useTheme();
  const [data, setData] = useState<any[]>([]);

  const frontendUrl = (settings?.frontend_url || '').replace(/\/$/, '');
  
  // Find the collection by matching the short slug and the explicit pluginSlug
  const collection = collections.find(c => {
    // Check if the actual collection slug (prefixed) matches the URL slug (short)
    // We check against:
    // 1. shortSlug (pretty name like 'pages')
    // 2. slug (technical prefixed name like 'fcp_cms_cms-pages')
    // 3. unprefixedSlug (the name the plugin dev gave it before framework prefixing like 'cms-pages')
    const isSlugMatch = c.shortSlug === slug || c.slug === slug || c.unprefixedSlug === slug;
    const isPluginMatch = c.pluginSlug === pluginSlug || (c.pluginSlug === 'cms' && pluginSlug === 'cms');
    
    return isSlugMatch && isPluginMatch;
  });

  // Basic search state
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('-createdAt');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const resolvedSlug = collection?.slug || slug;

  // Simple debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('page', page.toString());
        queryParams.append('limit', '10');
        if (debouncedSearch) queryParams.append('search', debouncedSearch);
        if (sort) queryParams.append('sort', sort);

        const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}?${queryParams.toString()}`);
        
        if (result.docs) {
          setData(result.docs);
          setTotal(result.totalDocs);
        }
      } catch (err) {
        console.error("Failed to fetch collection data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [resolvedSlug, debouncedSearch, page, sort]);

  const handleExport = async (format: 'json' | 'csv', ids?: string[]) => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', format);
      queryParams.append('token', Cookies.get('fromcode_token') || '');
      if (ids && ids.length > 0) {
        queryParams.append('ids', ids.join(','));
      }
      window.open(`${api.getBaseUrl()}${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/export?${queryParams.toString()}`, '_blank');
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        const result = await api.post(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/import`, data);
        alert(`Imported ${result.success} records successfully. ${result.errors.length} errors.`);
        window.location.reload();
      } catch (error: any) {
        alert('Import failed: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.length} selected records?`)) {
      setLoading(true);
      try {
        await api.post(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/bulk-delete`, { ids: selectedIds });
        setSelectedIds([]);
        // Refresh
        setPage(1);
        const queryParams = new URLSearchParams();
        queryParams.append('page', '1');
        queryParams.append('limit', '10');
        if (debouncedSearch) queryParams.append('search', debouncedSearch);
        const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}?${queryParams.toString()}`);
        if (result.docs) {
          setData(result.docs);
          setTotal(result.totalDocs);
        }
      } catch (error) {
        alert('Error performing bulk delete');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      await api.post(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/bulk-update`, { 
        ids: selectedIds, 
        data: { status: newStatus } 
      });
      setSelectedIds([]);
      // Refresh
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', '10');
      if (debouncedSearch) queryParams.append('search', debouncedSearch);
      const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}?${queryParams.toString()}`);
      if (result.docs) {
        setData(result.docs);
        setTotal(result.totalDocs);
      }
    } catch (error) {
      alert('Error updating status');
    } finally {
      setLoading(false);
    }
  };

  if (!collection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in-95 duration-700">
        <div className={`p-8 rounded-[40px] mb-8 relative group ${theme === 'dark' ? 'bg-slate-900 shadow-2xl shadow-black/50' : 'bg-white shadow-2xl shadow-slate-200'}`}>
           <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
           <FrameworkIcons.Search size={64} className="text-indigo-500 relative z-10" strokeWidth={1} />
        </div>
        
        <h2 className={`text-4xl font-black tracking-tighter uppercase mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Collection Not Found
        </h2>
        
        <p className="text-slate-500 font-bold text-center max-w-sm leading-relaxed mb-10 px-6">
          The collection <span className="text-indigo-500">"{slug}"</span> doesn't seem to be part of the <span className="text-indigo-500 uppercase tracking-widest text-xs ml-1">{pluginSlug}</span> plugin registry.
        </p>

        <div className="flex items-center gap-4">
          <Button 
            variant="ghost"
            onClick={() => window.history.back()}
            className="rounded-2xl px-8 font-black uppercase tracking-widest text-xs text-slate-400"
          >
            Go Back
          </Button>
          <Button 
            variant="primary" 
            as={Link}
            href="/"
            className="rounded-2xl px-10 py-5 font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-500/30"
            icon={<FrameworkIcons.Layout size={18} />}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const columns = [
    ...(collection.admin?.defaultColumns || collection.fields.filter(f => !f.hidden).slice(0, 3).map(f => f.name)).map(col => ({
      header: col.charAt(0).toUpperCase() + col.slice(1),
      id: col,
      accessor: (row: any) => String(row[col] || '-'),
      sortable: true
    })),
    {
      header: 'Created At',
      id: 'createdAt',
      accessor: (row: any) => new Date(row.createdAt).toLocaleDateString(),
      sortable: true
    }
  ];

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this record?')) {
      try {
        await api.delete(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${id}`);
        // Refresh data
        setPage(1);
        const queryParams = new URLSearchParams();
        queryParams.append('page', '1');
        queryParams.append('limit', '10');
        if (debouncedSearch) queryParams.append('search', debouncedSearch);
        
        const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}?${queryParams.toString()}`);
        if (result.docs) {
          setData(result.docs);
          setTotal(result.totalDocs);
        }
      } catch (error) {
        alert('Error deleting record');
      }
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-xl shadow-inner ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-indigo-50 border border-indigo-100'} text-indigo-500`}>
                <FrameworkIcons.Layout size={20} />
              </div>
              <h1 className={`text-3xl font-black tracking-tighter uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {collection.slug === 'users' ? 'User Management' : (collection.name || slug.charAt(0).toUpperCase() + slug.slice(1))}
              </h1>
            </div>
            <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
              {collection.slug === 'users' 
                ? 'Manage system users, roles and security permissions.' 
                : `Manage and organize ${(collection.name || slug).toLowerCase()} records.`}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Slot name={`admin.collection.${slug}.header.actions`} props={{ collection }} />
            <Slot name="admin.collection.list.header.actions" props={{ collection }} />
            {collection.slug === 'users' && (
              <Button 
                variant="secondary"
                size="sm"
                className="h-11 rounded-xl font-bold uppercase tracking-widest text-xs"
                icon={<FrameworkIcons.More size={18} />}
              >
                Invite
              </Button>
            )}
            <Button 
              variant="primary" 
              size="sm"
              as={Link}
              href={`/${pluginSlug}/${slug}/new`}
              className="px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-indigo-600/30"
              icon={<FrameworkIcons.Plus size={18} />}
            >
              {collection.slug === 'users' ? 'Create User' : 'New Entry'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-6 lg:px-12 py-12 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className={`flex-1 relative group`}>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <FrameworkIcons.Search size={18} />
            </div>
            <input 
              type="text"
              placeholder={`Search ${slug}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border transition-all text-sm font-bold outline-none ${
                theme === 'dark' 
                  ? 'bg-slate-900/50 border-slate-800 focus:border-indigo-500/50 focus:bg-slate-900 text-white shadow-2xl shadow-black/40' 
                  : 'bg-white border-slate-200 focus:border-indigo-500 shadow-xl shadow-slate-200/50 text-slate-900'
              }`}
            />
          </div>

          {selectedIds.length > 0 && (
            <div className={`flex items-center flex-wrap gap-2 p-2 rounded-2xl animate-in slide-in-from-top-2 duration-300 ${
              theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100 border border-slate-200'
            }`}>
              <div className="px-4 text-xs font-black uppercase tracking-widest text-indigo-500 border-r border-slate-200 dark:border-slate-800 mr-2">
                {selectedIds.length} Selected
              </div>
              
              <div className="flex items-center gap-1 group/bulk">
                {['published', 'draft', 'archived'].map(s => (
                  <button
                    key={s}
                    onClick={() => handleBulkStatusChange(s)}
                    className={`h-10 px-4 text-[11px] font-black uppercase tracking-tighter rounded-xl transition-all ${
                      theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-white text-slate-500 hover:text-indigo-600'
                    }`}
                  >
                    Set {s}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2" />

              <Button 
                variant="secondary" 
                size="sm" 
                className="rounded-xl h-10 px-4 text-[12px] font-black uppercase tracking-widest"
                icon={<FrameworkIcons.Download size={14} />}
                onClick={() => handleExport('json', selectedIds)}
              >
                Export
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                className="rounded-xl h-10 px-4 text-[12px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600"
                icon={<FrameworkIcons.Trash size={14} />}
                onClick={handleBulkDelete}
              >
                Delete
              </Button>
              <button 
                onClick={() => setSelectedIds([])}
                className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Clear selection"
              >
                <FrameworkIcons.Close size={16} />
              </button>
            </div>
          )}
        </div>

        <div className={`rounded-3xl border overflow-hidden shadow-2xl shadow-slate-200/40 dark:shadow-none transition-all duration-300 ${
          theme === 'dark' ? 'bg-slate-900/40 border-slate-800/50 backdrop-blur-sm' : 'bg-white border-white shadow-xl'
        }`}>
          <DataTable
            columns={columns}
            data={data || []}
            loading={loading}
            totalDocs={total}
            limit={10}
            page={page}
            onPageChange={setPage}
            onSort={setSort}
            currentSort={sort}
            onRowClick={(row) => (window.location.href = `/${pluginSlug}/${slug}/${row.id}`)}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            actions={(row) => {
              const getRowPreviewUrl = () => {
                if (!frontendUrl) return '#';
                
                // PRIORITY: If we have an explicit custom permalink override, use it directly
                if (row.customPermalink) {
                  return `${frontendUrl}/${row.customPermalink.startsWith('/') ? row.customPermalink.substring(1) : row.customPermalink}?preview=1&draft=1`;
                }

                // FALLBACK: Use the global structure logic
                const pathValue = row.slug || row.id;
                const structure = settings?.permalink_structure || '/:slug';
                
                const now = new Date();
                const replacements: Record<string, string> = {
                  ':year': now.getFullYear().toString(),
                  ':month': (now.getMonth() + 1).toString().padStart(2, '0'),
                  ':day': now.getDate().toString().padStart(2, '0'),
                  ':id': row.id,
                  ':slug': pathValue,
                };

                let path = structure;
                Object.entries(replacements).forEach(([key, val]) => {
                  path = path.replace(key, val);
                });

                // Clean up double slashes and ensure leading slash
                path = path.replace(/\/+/g, '/');
                if (!path.startsWith('/')) path = '/' + path;

                return `${frontendUrl}${path}?preview=1&draft=1`;
              };

              return (
                <div className="flex items-center justify-end gap-2">
                  <a 
                    href={getRowPreviewUrl()}
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className={`p-2.5 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
                  >
                    <FrameworkIcons.Eye size={16} />
                  </a>
                  <Link 
                    href={`/${pluginSlug}/${slug}/${row.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`p-2.5 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
                  >
                    <FrameworkIcons.Edit size={16} />
                  </Link>
                  <button 
                    onClick={(e) => handleDelete(row.id, e)}
                    className={`p-2.5 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-rose-500/10 text-slate-500 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'}`}
                  >
                    <FrameworkIcons.Trash size={16} />
                  </button>
                </div>
              );
            }}
          />
        </div>
      </div>

      {/* Premium Footer */}
      <div className={`mt-auto border-t py-12 backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/40 border-slate-800' 
          : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="w-full px-6 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)] animate-pulse" />
                <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Data Management Node // {slug.toUpperCase()}
                </span>
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-tight opacity-70 text-center md:text-left">
                Connected to {total} records in the system cluster.
              </p>
            </div>
            
            <div className="flex items-center gap-10 text-xs font-black uppercase tracking-widest text-slate-400">
              <button 
                onClick={() => handleExport('json')}
                className="hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300"
              >
                Export JSON
              </button>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <label 
                className="cursor-pointer hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300"
              >
                Bulk Import
                <input type="file" className="hidden" accept=".json" onChange={handleImport} />
              </label>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <a 
                href={`${api.getBaseUrl()}${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}`} 
                target="_blank" 
                className="hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300"
              >
                API Endpoint
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
