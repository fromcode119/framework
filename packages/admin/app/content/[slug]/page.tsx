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
  const { slug } = useParams() as { slug: string };
  const { collections } = usePlugins();
  const { theme } = useTheme();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('-createdAt');

  const collection = collections.find(c => c.slug === slug);

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
        const query = {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          sort
        };
        const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${slug}`, { params: query });
        
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
  }, [slug, debouncedSearch, page, sort]);

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
        await api.delete(`${ENDPOINTS.COLLECTIONS.BASE}/${slug}/${id}`);
        // Refresh data
        setPage(1);
        const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${slug}`);
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
    <div className="flex flex-col h-full -mx-8 -mt-8 overflow-hidden">
      {/* Header section with white high-contrast style */}
      <div className={`p-8 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'} bg-white dark:bg-transparent shadow-sm dark:shadow-none`}>
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-slate-800' : 'bg-indigo-50'} text-indigo-500`}>
                  <FrameworkIcons.Layout size={20} />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tight">
                  {collection.slug === 'users' ? 'User Management' : (collection.name || slug.charAt(0).toUpperCase() + slug.slice(1))}
                </h1>
              </div>
              <p className="text-slate-500 font-medium text-sm">
                {collection.slug === 'users' ? 'Manage system users, roles and security permissions.' : `Manage and organize ${collection.slug} records.`}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Slot name={`admin.collection.${slug}.header.actions`} props={{ collection }} />
              <Slot name="admin.collection.list.header.actions" props={{ collection }} />
              {collection.slug === 'users' && (
                <Button 
                  variant="secondary"
                  icon={<FrameworkIcons.More size={18} />}
                >
                  Invite
                </Button>
              )}
              <Button 
                variant="primary" 
                as={Link}
                href={`/content/${slug}/new`}
                icon={<FrameworkIcons.Plus size={18} />}
              >
                {collection.slug === 'users' ? 'Create User' : 'New Entry'}
              </Button>
            </div>
          </div>

          <div className="mt-8 flex flex-col md:flex-row md:items-center gap-4">
            <div className={`flex-1 relative group`}>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                <FrameworkIcons.Search size={18} />
              </div>
              <input 
                type="text"
                placeholder={`Search ${slug}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full pl-12 pr-4 py-3 rounded-2xl border transition-all text-sm outline-none font-medium ${
                  theme === 'dark' 
                    ? 'bg-slate-900 border-slate-800 focus:border-indigo-500' 
                    : 'bg-white border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-transparent p-6">
        <div className="max-w-[1200px] mx-auto">
          <div className={`rounded-3xl border overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none ${
            theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'
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
              onRowClick={(row) => (window.location.href = `/content/${slug}/${row.id}`)}
              actions={(row) => (
                <div className="flex items-center justify-end gap-2">
                  <Link 
                    href={`/content/${slug}/${row.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
                  >
                    <FrameworkIcons.Edit size={16} />
                  </Link>
                  <button 
                    onClick={(e) => handleDelete(row.id, e)}
                    className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all dark:hover:bg-rose-500/10"
                  >
                    <FrameworkIcons.Trash size={16} />
                  </button>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
