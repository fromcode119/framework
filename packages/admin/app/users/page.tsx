"use client";

import React from 'react';
import { Slot } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@fromcode119/react';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { Loader } from '@/components/ui/loader';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AdminPageFooter } from '@/components/ui/admin-page-footer';
import { AdminComponent } from '@/components/admin-component';
import { buildUsersColumns } from './users-columns';
import { UsersRowActions } from './users-row-actions';
import { UsersPageHeader } from './users-page-header';
import type { User, UsersPageState } from './users-page.interfaces';

export default class UsersPage extends AdminComponent<Record<string, never>, UsersPageState> {
  private mounted = false;

  state: UsersPageState = {
    searchQuery: '',
    users: [],
    loading: true,
    stats: { total: 0, active: 0, roles: 0 },
    deleteConfirm: null,
    isDeleting: false,
  };

  componentDidMount(): void {
    this.mounted = true;
    void this.fetchUsers();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchUsers(): Promise<void> {
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USERS);
      const userData = response.docs || [];
      if (!this.mounted) return;

      // Stats based on real RBAC data
      const activeUsers = userData.filter((user: any) => String(user.accountStatus || 'active').toLowerCase() !== 'suspended').length;
      this.setState({
        users: userData,
        stats: {
          total: userData.length,
          active: activeUsers,
          roles: new Set(userData.flatMap((u: any) => u.roles || [])).size || 1,
        },
      });
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private async handleDelete(): Promise<void> {
    const { deleteConfirm } = this.state;
    if (!deleteConfirm) return;
    this.setState({ isDeleting: true });
    try {
      await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.USER(deleteConfirm.id));
      await this.fetchUsers();
      this.setState({ deleteConfirm: null });
    } finally {
      this.setState({ isDeleting: false });
    }
  }

  private get filteredUsers(): User[] {
    const { users, searchQuery } = this.state;
    return users.filter(u =>
      (u.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       u.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       (u.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()))
    );
  }

  private get columns(): any[] {
    return buildUsersColumns(this.theme);
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { searchQuery, loading, stats, deleteConfirm, isDeleting } = this.state;

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label="Decrypting User Database..." />
        </div>
      );
    }

    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
        <UsersPageHeader theme={theme} />

        <div className="flex-1 w-full px-6 lg:px-12 py-12 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="User Base"
              value={stats.total.toLocaleString()}
              icon={<FrameworkIcons.Users size={20} />}
              trend={{ value: 4, isPositive: true }}
            />
            <StatCard
              title="Active Now"
              value={stats.active.toLocaleString()}
              icon={<FrameworkIcons.UserCheck size={20} />}
            />
            <StatCard
              title="Access Levels"
              value={stats.roles.toLocaleString()}
              icon={<FrameworkIcons.Shield size={20} />}
            />
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                <FrameworkIcons.Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Search user base by name or email..."
                value={searchQuery}
                onChange={(e) => this.setState({ searchQuery: e.target.value })}
                className={`w-full h-11 rounded-xl pl-12 pr-4 outline-none border transition-all text-[13px] font-bold tracking-tight ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-800 text-white focus:border-indigo-500/50 focus:bg-slate-900 shadow-2xl shadow-black/40'
                    : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-xl shadow-slate-200/50'
                }`}
              />
            </div>
          </div>

          <div className={`rounded-3xl border overflow-hidden shadow-2xl shadow-slate-200/40 dark:shadow-none transition-all duration-300 ${
            theme === 'dark' ? 'bg-slate-900/40 border-slate-800/50 backdrop-blur-sm' : 'bg-white border-white shadow-xl'
          }`}>
            <DataTable
              columns={this.columns}
              data={this.filteredUsers}
              loading={false}
              totalDocs={this.filteredUsers.length}
              limit={10}
              page={1}
              emptyMessage="No user records match your query"
              actions={(user) => (
                <UsersRowActions
                  user={user}
                  theme={theme}
                  onNavigate={(href) => this.router.push(href)}
                  onRequestDelete={(u) => this.setState({ deleteConfirm: u })}
                />
              )}
            />
          </div>

          <Slot name="admin.users.list.bottom" />
        </div>

        <ConfirmDialog
          isOpen={!!deleteConfirm}
          onClose={() => this.setState({ deleteConfirm: null })}
          onConfirm={() => this.handleDelete()}
          isLoading={isDeleting}
          title="Revoke Access?"
          description={`This will permanently delete ${deleteConfirm?.email}'s account and revoke all system access. This action cannot be undone.`}
          confirmLabel="Deactivate User"
        />

        <AdminPageFooter
          label="User Management Infrastructure"
          description="Manage user accounts and security roles."
          links={[
            { label: 'Roles', href: AdminConstants.ROUTES.USERS.ROLE_LIST },
            { label: 'Permissions', href: AdminConstants.ROUTES.USERS.PERMISSIONS },
            { label: 'Activity Log', href: AdminConstants.ROUTES.ACTIVITY },
          ]}
        />
      </div>
    );
  }
}
