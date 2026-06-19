'use client';

import React, { useState, useEffect } from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeading } from '@/components/ui/page-heading';
import { FrameworkIcons } from '@fromcode119/react';
import { DataTable } from '@/components/ui/data-table';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { Loader } from '@/components/ui/loader';
import { AdminPageFooter } from '@/components/ui/admin-page-footer';
import Link from 'next/link';
import { PermissionsColumns } from './permissions-columns';

export default function PermissionsPage() {
  const { theme } = ThemeHooks.useTheme();
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    async function loadPermissions() {
      try {
        const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERMISSIONS);
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

  const columns = PermissionsColumns.build(theme);

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
            <PageHeading
              icon={
                <div className={`h-11 w-11 rounded-full flex items-center justify-center shadow-lg transform rotate-6 transition-transform hover:rotate-0 ${
                  theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-600 text-white'
                }`}>
                  <FrameworkIcons.Zap size={22} strokeWidth={2} />
                </div>
              }
              title="Permissions"
              subtitle="Manage and audit granular access permissions across the system."
              subtitleClassName="text-slate-500 font-bold text-sm tracking-tight opacity-70 mt-2"
            />
            
            <div className="flex items-center gap-4">
              <Link href={AdminConstants.ROUTES.USERS.PERMISSIONS_NEW}>
                <Button 
                  variant="secondary"
                  className="h-11 px-6 rounded-xl font-bold uppercase tracking-tight text-[10px] border-slate-200 dark:border-slate-800"
                  icon={<FrameworkIcons.Plus size={16} />}
                >
                  Define Permission
                </Button>
              </Link>
              <Button 
                variant="secondary"
                className="h-11 px-6 rounded-xl font-bold uppercase tracking-tight text-[10px] border-slate-200 dark:border-slate-800"
                icon={<FrameworkIcons.More size={16} />}
                isLoading={isRefreshing}
                onClick={async () => {
                   setIsRefreshing(true);
                   try {
                     const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERMISSIONS);
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
          <div className={`rounded-3xl border overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none ${
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
                <p className="text-sm text-slate-500 leading-relaxed font-bold tracking-tight">
                  Permissions are the atomic units of security in Fromcode. They are declared by plugins via their <code className="text-indigo-500">manifest.json</code> and enforced by the middleware layer. Administrators can group these into roles for simplified user management.
                </p>
              </Card>
              <Card title="Drift Detection">
                <p className="text-sm text-slate-500 leading-relaxed font-bold tracking-tight italic">
                  The registry is automatically updated when a plugin with new capabilities is installed. New permissions are marked as <span className="text-rose-500 font-bold uppercase">unverified</span> until a system administrator reviews and approves the capability drift.
                </p>
              </Card>
          </div>
        </div>
      </div>

      <AdminPageFooter
        label="Permissions Registry"
        description="Manage system capabilities and plugin permissions."
        links={[
          { label: 'Users', href: AdminConstants.ROUTES.USERS.LIST },
          { label: 'Roles', href: AdminConstants.ROUTES.USERS.ROLE_LIST },
          { label: 'Activity Log', href: AdminConstants.ROUTES.ACTIVITY },
        ]}
      />
    </div>
  );
}
