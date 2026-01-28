'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FrameworkIcons } from '@/lib/icons';
import { DataTable } from '@/components/ui/DataTable';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { Loader } from '@/components/ui/Loader';
import Link from 'next/link';

export default function PermissionsPage() {
  const { theme } = useTheme();
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    async function loadPermissions() {
      try {
        const data = await api.get(ENDPOINTS.SYSTEM.PERMISSIONS);
        setPermissions(data || []);
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPermissions();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader label="Inventorying Permissions..." />
      </div>
    );
  }

  const columns = [
    {
      header: 'Identifier',
      id: 'name',
      accessor: (p: any) => (
        <div className="flex flex-col gap-1">
          <span className={`font-mono font-black text-[11px] px-2.5 py-1 rounded-lg border shadow-sm w-fit ${
            theme === 'dark' 
              ? 'bg-slate-950 border-slate-800 text-indigo-400' 
              : 'bg-indigo-50 border-indigo-100 text-indigo-800'
          }`}>
            {p.name}
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">ID: {p.cid || 'SYS-AUTO'}</span>
        </div>
      )
    },
    {
      header: 'Domain',
      id: 'group',
      accessor: (p: any) => (
        <Badge variant={p.group === 'System' || p.group === 'Core' ? 'amber' : 'blue'} className="font-black uppercase tracking-[0.2em] text-[8px] px-3 border-none flex items-center gap-2">
          <div className={`h-1 w-1 rounded-full ${p.group === 'System' || p.group === 'Core' ? 'bg-amber-500' : 'bg-blue-500'}`} />
          {p.group || 'General'}
        </Badge>
      )
    },
    {
      header: 'Source',
      id: 'pluginSlug',
      accessor: (p: any) => (
        <div className="flex items-center gap-2">
           <div className={`h-6 w-6 rounded border flex items-center justify-center ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <FrameworkIcons.Plugins size={12} className="text-slate-400" />
           </div>
           <span className="text-[10px] font-black uppercase tracking-tight text-slate-500">
             {p.pluginSlug || 'System Core'}
           </span>
        </div>
      )
    },
    {
      header: 'Security Risk',
      id: 'impact',
      accessor: (p: any) => (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 w-16 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${
              p.impact === 'Critical' ? 'w-full bg-rose-500' :
              p.impact === 'High' ? 'w-[75%] bg-amber-500' :
              p.impact === 'Medium' ? 'w-[40%] bg-indigo-500' : 'w-[20%] bg-emerald-500'
            }`} />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest ${
            p.impact === 'Critical' ? 'text-rose-500' :
            p.impact === 'High' ? 'text-amber-500' :
            p.impact === 'Medium' ? 'text-indigo-500' : 'text-emerald-500'
          }`}>{p.impact || 'Normal'}</span>
        </div>
      )
    },
    {
      header: 'Definition',
      id: 'description',
      accessor: (p: any) => (
        <span className="text-sm font-semibold text-slate-500 leading-relaxed block max-w-sm">{p.description}</span>
      )
    }
  ];

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      {/* Premium Permissions Header */}
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)]'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center shadow-lg transform rotate-6 transition-transform hover:rotate-0 ${
                  theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-600 text-white'
                }`}>
                  <FrameworkIcons.Zap size={22} strokeWidth={2.5} />
                </div>
                <h1 className={`text-3xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Permissions
                </h1>
              </div>
              <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
                Manage and audit granular access permissions across the system.
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Link href="/users/permissions/new">
                <Button 
                  variant="secondary"
                  className="px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] border-slate-200 dark:border-slate-800"
                  icon={<FrameworkIcons.Plus size={16} />}
                >
                  Define Permission
                </Button>
              </Link>
              <Button 
                variant="secondary"
                className="px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] border-slate-200 dark:border-slate-800"
                icon={<FrameworkIcons.More size={16} />}
                isLoading={isRefreshing}
                onClick={async () => {
                   setIsRefreshing(true);
                   try {
                     const data = await api.get(ENDPOINTS.SYSTEM.PERMISSIONS);
                     setPermissions(data || []);
                   } finally {
                     setIsRefreshing(false);
                   }
                }}
              >
                Scan Plugins
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-6 lg:px-12 py-12">
        <div className="space-y-8 pb-12">
          <div className={`rounded-[2.5rem] border overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none ${
            theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200/60'
          }`}>
            <DataTable
              columns={columns}
              data={permissions}
              totalDocs={permissions.length}
              limit={100}
              page={1}
              emptyMessage="No permissions registered in system registry"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card title="Security Architecture">
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Permissions are the atomic units of security in Fromcode. They are declared by plugins via their <code className="text-indigo-500">manifest.json</code> and enforced by the middleware layer. Administrators can group these into roles for simplified user management.
                </p>
              </Card>
              <Card title="Drift Detection">
                <p className="text-xs text-slate-500 leading-relaxed font-medium italic">
                  The registry is automatically updated when a plugin with new capabilities is installed. New permissions are marked as <span className="text-rose-500 font-black uppercase">unverified</span> until a system administrator reviews and approves the capability drift.
                </p>
              </Card>
          </div>
        </div>
      </div>

      {/* Premium Footer */}
      <div className={`mt-auto border-t ${
        theme === 'dark' ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Permissions Registry
                </span>
              </div>
              <p className="text-[9px] font-bold text-slate-400">Manage system capabilities and plugin permissions.</p>
            </div>
            
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
               <Link href="/users" className="hover:text-indigo-500 transition-colors">Users</Link>
               <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-800" />
               <Link href="/users/roles" className="hover:text-indigo-500 transition-colors">Roles</Link>
               <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-800" />
               <Link href="/activity" className="hover:text-indigo-500 transition-colors">Activity Log</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
