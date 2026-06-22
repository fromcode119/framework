"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
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
      this.runtime.notify.notify('success', 'Role created', `"${this.state.formData.name}" was created.`);
      this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST);
    } catch (e: any) {
      this.runtime.notify.notify('error', 'Could not create role', e?.message || 'Failed to save role.');
    } finally {
      this.setState({ loading: false });
    }
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { loading, permissions, formData } = this.state;
    return (
      <div className="w-full flex flex-col animate-in fade-in duration-300">
        <CompactPageHeader
          theme={theme}
          onBack={() => this.router.back()}
          title="Create new role"
          subtitle="Define a set of permissions to assign to users."
        />

        <div className="flex-1 w-full px-6 lg:px-8 py-6">
          <form onSubmit={(e) => this.handleSubmit(e)} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <Card title="Role Details">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Name"
                      placeholder="e.g. Editor"
                      value={formData.name}
                      onChange={(e) => this.handleNameChange(e.target.value)}
                      required
                      size="sm"
                    />
                    <Input
                      label="Slug (System ID)"
                      placeholder="e.g. editor"
                      value={formData.slug}
                      onChange={(e) => this.patchForm({ slug: e.target.value })}
                      required
                      size="sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-tight text-slate-400 pl-1">Description</label>
                    <textarea
                      className={`w-full h-24 rounded-lg p-3 border outline-none transition-colors text-sm font-medium ${
                        theme === 'dark' ? 'bg-slate-950/50 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
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
