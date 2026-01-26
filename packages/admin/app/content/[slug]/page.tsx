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

export default function CollectionListPage() {
  const { slug } = useParams() as { slug: string };
  const { collections } = usePlugins();
  const { theme } = useTheme();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

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
        const query = debouncedSearch ? { search: debouncedSearch } : undefined;
        const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${slug}`, query);
        
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
  }, [slug, debouncedSearch]);

  if (!collection) {
    return <div>Collection {slug} not found</div>;
  }

  const columns = collection.admin?.defaultColumns || ['id', ...collection.fields.slice(0, 3).map(f => f.name)];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {collection.slug === 'users' ? 'Identity Management' : (collection.name || slug.charAt(0).toUpperCase() + slug.slice(1))}
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            {collection.slug === 'users' ? 'Manage system users, roles and security permissions.' : `Manage and organize ${collection.slug} records.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Slot name={`admin.collection.${slug}.header.actions`} props={{ collection }} />
          <Slot name="admin.collection.list.header.actions" props={{ collection }} />
          {collection.slug === 'users' && (
            <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 rounded-xl font-bold transition-all shadow-sm">
              <span>Invite</span>
            </button>
          )}
          <Link 
            href={`/content/${slug}/new`}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all transform hover:scale-[1.02] shadow-lg shadow-indigo-600/20"
          >
            <FrameworkIcons.Plus size={18} />
            <span>{collection.slug === 'users' ? 'Create User' : 'New Entry'}</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <FrameworkIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder={`Search ${slug}...`} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full rounded-xl py-3 pl-10 pr-4 outline-none border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`} 
          />
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'} border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                {columns.map(col => (
                  <th key={col} className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    {col}
                  </th>
                ))}
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="p-10 text-center text-slate-500">Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="p-10 text-center text-slate-500">No entries found</td></tr>
              ) : (
                data.map((entry) => (
                  <tr key={entry.id} className={`group border-b ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-900/50' : 'border-slate-100 hover:bg-slate-50/50'} transition-colors`}>
                    {columns.map(col => (
                       <td key={col} className="px-8 py-5">
                         <span className={`font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                           {String(entry[col] || '-')}
                         </span>
                       </td>
                    ))}
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-end gap-2">
                         <Link 
                           href={`/content/${slug}/${entry.id}`}
                           className={`p-2 rounded-lg hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-600 transition-colors`}
                         >
                           <FrameworkIcons.Edit size={18} />
                         </Link>
                         <button className={`p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-600 transition-colors`}>
                           <FrameworkIcons.More size={18} />
                         </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing <span className="font-bold">{data.length}</span> of <span className="font-bold">{total}</span> entries
        </p>
      </div>
    </div>
  );
}
