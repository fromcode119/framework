"use client";

import React from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/button';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import Link from 'next/link';
import { Loader } from '@/components/ui/loader';
import { AdminComponent } from '@/components/admin-component';
import type { UserRolesPageProps, UserRolesPageState } from './user-roles-page.interfaces';

export default class UserRolesPage extends AdminComponent<UserRolesPageProps, UserRolesPageState> {
  private mounted = false;

  state: UserRolesPageState = {
    routeId: '',
    user: null,
    roles: [],
    selectedRoles: [],
    loading: true,
    saving: false,
  };

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.props.params;
    if (!this.mounted) return;
    this.setState({ routeId: params.id }, () => void this.fetchData());
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchData(): Promise<void> {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USERS),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.ROLES)
      ]);

      const foundUser = (usersRes.docs || []).find((u: any) => String(u.id) === String(this.state.routeId));
      if (foundUser && this.mounted) {
        this.setState({ user: foundUser, selectedRoles: foundUser.roles || [] });
      }

      if (this.mounted) this.setState({ roles: rolesRes || [] });
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private async handleSave(): Promise<void> {
    this.setState({ saving: true });
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USER_ROLES, {
        userId: this.state.routeId,
        roles: this.state.selectedRoles
      });
      this.runtime.notify.notify('success', 'Roles updated', 'The user\'s roles were saved.');
      this.router.push('/users');
    } catch (err: any) {
      this.runtime.notify.notify('error', 'Save failed', err?.message || 'Failed to save roles.');
    } finally {
      this.setState({ saving: false });
    }
  }

  private toggleRole(slug: string): void {
    this.setState((prev) => ({
      selectedRoles: prev.selectedRoles.includes(slug)
        ? prev.selectedRoles.filter((s) => s !== slug)
        : [...prev.selectedRoles, slug],
    }));
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { user, roles, selectedRoles, loading, saving } = this.state;

    const dark = theme === 'dark';
    if (loading) return <Loader label="Loading roles" className="py-20" />;
    if (!user) return <div className="p-8 text-center font-semibold text-red-500">User not found</div>;

    return (
      <div className="w-full flex flex-col animate-in fade-in duration-300">
        <CompactPageHeader
          theme={theme}
          backHref="/users"
          title="Manage roles"
          subtitle={user.email}
          actions={
            <Button
              className="h-9 px-4 rounded-lg font-semibold text-xs text-white"
              isLoading={saving}
              onClick={() => void this.handleSave()}
              icon={<FrameworkIcons.Save size={14} strokeWidth={2} />}
            >
              Save
            </Button>
          }
        />

        <div className="flex-1 w-full px-6 lg:px-8 py-6">
          <div className="max-w-2xl space-y-2">
            {roles.map(role => {
              const isSelected = selectedRoles.includes(role.slug);
              const permCount = Array.isArray(role.permissions) ? role.permissions.length : 0;
              return (
                <button
                  key={role.slug}
                  type="button"
                  onClick={() => this.toggleRole(role.slug)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    isSelected
                      ? (dark ? 'bg-indigo-500/10 border-indigo-500/60' : 'bg-indigo-50 border-indigo-300')
                      : (dark ? 'bg-slate-900/40 border-slate-800 hover:bg-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50')
                  }`}
                >
                  <span className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-indigo-600 text-white' : (dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400')
                  }`}>
                    <FrameworkIcons.Shield size={15} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-semibold tracking-tight ${dark ? 'text-slate-100' : 'text-slate-900'}`}>{role.name}</span>
                    <span className="block text-xs font-medium text-slate-500 truncate">
                      {role.description || 'No description'}{permCount ? ` · ${permCount} permission${permCount === 1 ? '' : 's'}` : ''}
                    </span>
                  </span>
                  <span className={`h-5 w-5 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : (dark ? 'border-slate-700' : 'border-slate-300')
                  }`}>
                    {isSelected && <FrameworkIcons.Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
}
