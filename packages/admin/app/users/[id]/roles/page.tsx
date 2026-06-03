"use client";

import React from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
      this.router.push('/users');
    } catch (err) {
      console.error('Failed to save roles:', err);
      alert('Failed to save roles');
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

    if (loading) return <Loader label="Analyzing User Privileges" className="py-20" />;
    if (!user) return <div className="p-8 text-center font-semibold text-red-500">User not found</div>;

    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
          theme === 'dark'
            ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20'
            : 'bg-white/80 border-slate-100 shadow-sm'
        }`}>
          <div className="w-full px-6 lg:px-12 py-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                 <Link href="/users">
                   <button className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg ${
                     theme === 'dark' ? 'bg-slate-900 text-slate-400 hover:text-white ring-1 ring-white/10' : 'bg-white text-slate-500 hover:text-indigo-600 shadow-slate-200/50 hover:shadow-indigo-500/10'
                   }`}>
                     <FrameworkIcons.Left size={20} strokeWidth={2} />
                   </button>
                 </Link>
                 <div>
                   <h1 className={`text-3xl font-semibold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                     Manage User Roles
                   </h1>
                   <p className="text-slate-500 text-xs font-semibold uppercase tracking-tight mt-1 opacity-70">Enforcing access for {user.email}</p>
                 </div>
              </div>

              <Button
                className="px-6 py-2.5 rounded-xl font-semibold uppercase tracking-tight text-[10px] shadow-lg shadow-indigo-600/10 text-white"
                isLoading={saving}
                onClick={() => void this.handleSave()}
                icon={<FrameworkIcons.Save size={16} strokeWidth={2} />}
              >
                Save
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full px-6 lg:px-12 py-12">
          <div className="space-y-6 pb-20">
            <div className="grid grid-cols-1 gap-4">
              {roles.map(role => {
                const isSelected = selectedRoles.includes(role.slug);
                return (
                  <div
                    key={role.slug}
                    onClick={() => this.toggleRole(role.slug)}
                    className={`relative group cursor-pointer p-6 rounded-3xl border-2 transition-all duration-300 ${
                      isSelected
                        ? (theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-indigo-50 border-indigo-500 shadow-lg shadow-indigo-500/5')
                        : (theme === 'dark' ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm')
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                            isSelected
                              ? (theme === 'dark' ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white')
                              : (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400')
                          }`}>
                            <FrameworkIcons.Shield size={16} />
                          </div>
                          <span className={`text-lg font-semibold tracking-tight ${
                            isSelected
                             ? (theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600')
                             : (theme === 'dark' ? 'text-slate-200' : 'text-slate-900')
                          }`}>
                            {role.name}
                          </span>
                        </div>
                        <p className={`text-sm font-medium pl-11 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {role.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : (theme === 'dark' ? 'border-slate-700' : 'border-slate-200')
                      }`}>
                        {isSelected && <FrameworkIcons.Check size={14} strokeWidth={4} />}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-4 pl-11 flex flex-wrap gap-2">
                        {(role.permissions || []).slice(0, 5).map((p: string) => (
                          <Badge key={p} variant="blue" className="text-[9px] uppercase tracking-tight px-2 py-0.5 opacity-70">
                            {p}
                          </Badge>
                        ))}
                        {(role.permissions || []).length > 5 && (
                          <span className="text-[9px] font-semibold text-slate-400">
                            +{(role.permissions || []).length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
