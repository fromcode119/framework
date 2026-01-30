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
  const { collections } = usePlugins();
  const { theme } = useTheme();
  const [data, setData] = useState<any[]>([]);
  
  // Find the collection by matching the short slug and the explicit pluginSlug
  const collection = collections.find(c => {
    // Check if the actual collection slug (prefixed) matches the URL slug (short)
    const isSlugMatch = c.shortSlug === slug || c.slug === slug;
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

  if (!collection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <FrameworkIcons.Search size={48} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-bold">Collection Not Found</h2>
        <p className="text-slate-500">The collection "{slug}" does not exist in the system.</p>
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
                className="h-11 rounded-xl font-bold uppercase tracking-widest text-[10px]"
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
              className="px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-600/30"
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
            actions={(row) => (
              <div className="flex items-center justify-end gap-2">
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
            )}
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
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Data Management Node // {slug.toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight opacity-70 text-center md:text-left">
                Connected to {total} records in the system cluster.
              </p>
            </div>
            
            <div className="flex items-center gap-10 text-[11px] font-black uppercase tracking-widest text-slate-400">
              <Link href="#" className="hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300">Export Schema</Link>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <Link href="#" className="hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300">Bulk Import</Link>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <Link href="#" className="hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300">API Endpoint</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
