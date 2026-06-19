'use client';

import React, { useEffect, useState } from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeading } from '@/components/ui/page-heading';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { NotificationHooks } from '@/components/use-notification';
import { Loader } from '@/components/ui/loader';
import { AdminPageFooter } from '@/components/ui/admin-page-footer';
import { RolesListCard } from './roles-list-card';
import { RolesAuditSidebar } from './roles-audit-sidebar';

export default function RolesPage() {
  const { theme } = ThemeHooks.useTheme();
  const { notify } = NotificationHooks.useNotify();
  const [roles, setRoles] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchData() {
    try {
      setLoading(true);
      const [rolesRes, logsRes, healthRes] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.ROLES),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.LOGS),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.HEALTH)
      ]);

      const normalizedLogs = Array.isArray(logsRes?.docs)
        ? logsRes.docs
        : Array.isArray(logsRes)
          ? logsRes
          : [];

      setRoles(rolesRes || []);
      setLogs(normalizedLogs);
      setHealth(healthRes || null);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader label="Hydrating Security Matrix..." />
      </div>
    );
  }

  const handleDelete = async () => {
    if (!roleToDelete) return;
    setIsDeleting(true);
    try {
      await AdminApi.delete(`${AdminConstants.ENDPOINTS.SYSTEM.ROLES}/${roleToDelete.slug}`);
      notify('success', 'Role Deleted', `${roleToDelete.name} has been removed.`);
      fetchData();
      setShowDeleteConfirm(false);
    } catch (err: any) {
      notify('error', 'Deletion Failed', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      {/* Premium Roles Header */}
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)]'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <PageHeading
              icon={
                <div className={`h-11 w-11 rounded-full flex items-center justify-center shadow-lg transform -rotate-3 transition-transform hover:rotate-0 ${
                  theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-600 text-white'
                }`}>
                  <FrameworkIcons.Shield size={22} strokeWidth={2} />
                </div>
              }
              title="Roles"
              subtitle="Manage user roles and security permissions."
              subtitleClassName="text-slate-500 font-bold text-sm tracking-tight opacity-70 mt-2"
            />
            
            <div className="flex items-center gap-4">
              <Link href={AdminConstants.ROUTES.USERS.ROLE_NEW}>
                <Button 
                  className="px-6 h-11 rounded-xl font-bold uppercase tracking-tight text-[11px] shadow-lg shadow-indigo-600/10 text-white" 
                  icon={<FrameworkIcons.Plus size={16} strokeWidth={2} />}
                >
                  Create Role
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-6 lg:px-12 py-12">
        <div className="space-y-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-12 xl:col-span-8 space-y-6">
              <RolesListCard
                roles={roles}
                theme={theme}
                onRequestDelete={(role) => { setRoleToDelete(role); setShowDeleteConfirm(true); }}
              />
            </div>

            <RolesAuditSidebar logs={logs} health={health} loading={loading} theme={theme} />
          </div>
        </div>
      </div>

      <AdminPageFooter
        label="Roles Management"
        description="Manage and customize system access roles."
        links={[
          { label: 'Users', href: AdminConstants.ROUTES.USERS.LIST },
          { label: 'Permissions', href: AdminConstants.ROUTES.USERS.PERMISSIONS },
          { label: 'Activity Log', href: AdminConstants.ROUTES.ACTIVITY },
        ]}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Role"
        description={`Are you sure you want to remove the ${roleToDelete?.name} role? Users assigned to this role may lose access to critical system features.`}
        confirmLabel="Destroy Role"
      />
    </div>
  );
}
