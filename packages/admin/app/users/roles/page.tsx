"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loader } from '@/components/ui/loader';
import { AdminPageFooter } from '@/components/ui/admin-page-footer';
import { AdminComponent } from '@/components/admin-component';
import { RolesListCard } from './roles-list-card';
import { RolesAuditSidebar } from './roles-audit-sidebar';
import type { RolesPageState } from './roles-page.interfaces';

export default class RolesPage extends AdminComponent<Record<string, never>, RolesPageState> {
  private mounted = false;

  state: RolesPageState = {
    roles: [],
    logs: [],
    health: null,
    loading: true,
    showDeleteConfirm: false,
    roleToDelete: null,
    isDeleting: false,
  };

  componentDidMount(): void {
    this.mounted = true;
    void this.fetchData();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchData(): Promise<void> {
    try {
      if (this.mounted) this.setState({ loading: true });
      const [rolesRes, logsRes, healthRes] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.ROLES),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.LOGS),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.HEALTH),
      ]);
      const logs = Array.isArray(logsRes?.docs) ? logsRes.docs : Array.isArray(logsRes) ? logsRes : [];
      if (this.mounted) this.setState({ roles: rolesRes || [], logs, health: healthRes || null });
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private async handleDelete(): Promise<void> {
    const { roleToDelete } = this.state;
    const notify = this.runtime.notify.notify;
    if (!roleToDelete) return;
    this.setState({ isDeleting: true });
    try {
      await AdminApi.delete(`${AdminConstants.ENDPOINTS.SYSTEM.ROLES}/${roleToDelete.slug}`);
      notify('success', 'Role Deleted', `${roleToDelete.name} has been removed.`);
      await this.fetchData();
      this.setState({ showDeleteConfirm: false });
    } catch (err: any) {
      notify('error', 'Deletion Failed', err.message);
    } finally {
      this.setState({ isDeleting: false });
    }
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { roles, logs, health, loading, showDeleteConfirm, roleToDelete, isDeleting } = this.state;

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label="Hydrating Security Matrix..." />
        </div>
      );
    }

    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-300">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Shield size={18} strokeWidth={2} />}
          title="Roles"
          subtitle="Manage user roles and security permissions."
          actions={
            <Link href={AdminConstants.ROUTES.USERS.ROLE_NEW}>
              <Button className="px-4 h-9 rounded-lg font-semibold text-xs text-white" icon={<FrameworkIcons.Plus size={15} strokeWidth={2} />}>
                Create Role
              </Button>
            </Link>
          }
        />

        <div className="flex-1 w-full px-6 lg:px-8 py-6">
          <div className="space-y-6 pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-12 xl:col-span-8 space-y-6">
                <RolesListCard
                  roles={roles}
                  theme={theme}
                  onRequestDelete={(role) => this.setState({ roleToDelete: role, showDeleteConfirm: true })}
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
          onClose={() => this.setState({ showDeleteConfirm: false })}
          onConfirm={() => this.handleDelete()}
          isLoading={isDeleting}
          title="Delete Role"
          description={`Are you sure you want to remove the ${roleToDelete?.name} role? Users assigned to this role may lose access to critical system features.`}
          confirmLabel="Destroy Role"
        />
      </div>
    );
  }
}
