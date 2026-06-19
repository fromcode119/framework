"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AdminComponent } from '@/components/admin-component';
import { NewRolePermissionsCard } from './new-role-permissions-card';
import { NewRoleSummarySidebar } from './new-role-summary-sidebar';
import type { NewRoleFormData, NewRolePageState } from './new-role-page.interfaces';

export default class NewRolePage extends AdminComponent<Record<string, never>, NewRolePageState> {
  private mounted = false;

  state: NewRolePageState = {
    loading: false,
    permissions: [],
    formData: {
      slug: '',
      name: '',
      description: '',
      type: 'custom',
      permissions: [],
    },
  };

  componentDidMount(): void {
    this.mounted = true;
    void this.loadPermissions();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async loadPermissions(): Promise<void> {
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERMISSIONS);
      if (this.mounted) this.setState({ permissions: data || [] });
    } catch (e) {
      console.error("Failed to load permissions", e);
    }
  }

  private patchForm(patch: Partial<NewRoleFormData>): void {
    this.setState((prev) => ({ formData: { ...prev.formData, ...patch } }));
  }

  private togglePermission(perm: string): void {
    this.setState((prev) => ({
      formData: {
        ...prev.formData,
        permissions: prev.formData.permissions.includes(perm)
          ? prev.formData.permissions.filter(p => p !== perm)
          : [...prev.formData.permissions, perm],
      },
    }));
  }

  private handleNameChange(val: string): void {
    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '-');
    this.setState((prev) => ({
      formData: {
        ...prev.formData,
        name: val,
        slug: prev.formData.slug === '' || prev.formData.slug === val.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, -1) ? slug : prev.formData.slug,
      },
    }));
  }

  private async handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    this.setState({ loading: true });
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.ROLES, this.state.formData);
      this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST);
    } catch (e) {
      console.error("Failed to save role", e);
    } finally {
      this.setState({ loading: false });
    }
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { loading, permissions, formData } = this.state;
    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
          theme === 'dark'
            ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20'
            : 'bg-white/80 border-slate-100 shadow-sm'
        }`}>
          <div className="w-full px-6 lg:px-12 py-10">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => this.router.back()}
                className="h-12 w-12 rounded-2xl border border-slate-200 dark:border-slate-800"
              >
                <FrameworkIcons.Left size={20} strokeWidth={2} />
              </Button>
              <div>
                <h1 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Create New Role
                </h1>
                <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
                  Define sets of permissions to assign to your users.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full px-6 lg:px-12 py-12">
          <form onSubmit={(e) => this.handleSubmit(e)} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              <Card title="Role Details">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Name"
                      placeholder="e.g. Editor"
                      value={formData.name}
                      onChange={(e) => this.handleNameChange(e.target.value)}
                      required
                      className="h-11 rounded-xl font-semibold"
                    />
                    <Input
                      label="Slug (System ID)"
                      placeholder="e.g. editor"
                      value={formData.slug}
                      onChange={(e) => this.patchForm({ slug: e.target.value })}
                      required
                      className="h-11 rounded-xl font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-tight text-slate-400 pl-1">Description</label>
                    <textarea
                      className={`w-full h-32 rounded-2xl p-6 border outline-none transition-all text-sm font-semibold tracking-tight ${
                        theme === 'dark' ? 'bg-slate-950/50 border-slate-800 text-white focus:border-indigo-500 shadow-2xl shadow-black/40' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-xl shadow-slate-200/50'
                      }`}
                      placeholder="Optional description of what this role allows..."
                      value={formData.description}
                      onChange={(e) => this.patchForm({ description: e.target.value })}
                    />
                  </div>
                </div>
              </Card>

              <NewRolePermissionsCard
                theme={theme}
                permissions={permissions}
                selected={formData.permissions}
                onToggle={(perm) => this.togglePermission(perm)}
              />
            </div>

            <NewRoleSummarySidebar
              permissionCount={formData.permissions.length}
              loading={loading}
              onCancel={() => this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST)}
            />
          </form>
        </div>
      </div>
    );
  }
}
