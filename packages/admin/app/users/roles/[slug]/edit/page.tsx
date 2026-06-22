"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { Loader } from '@/components/ui/loader';
import { AdminComponent } from '@/components/admin-component';
import { EditRolePermissionsCard } from './edit-role-permissions-card';
import { EditRoleSummarySidebar } from './edit-role-summary-sidebar';
import type { EditRolePageProps, EditRolePageState } from './edit-role-page.interfaces';

export default class EditRolePage extends AdminComponent<EditRolePageProps, EditRolePageState> {
  private mounted = false;

  state: EditRolePageState = {
    roleSlug: '',
    loading: false,
    fetching: true,
    permissions: [],
    formData: {
      slug: '',
      name: '',
      description: '',
      type: 'custom',
      permissions: []
    },
  };

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.props.params;
    if (!this.mounted) return;
    this.setState({ roleSlug: params.slug }, () => void this.loadData());
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async loadData(): Promise<void> {
    const notify = this.runtime.notify.notify;
    try {
      this.setState({ fetching: true });
      const [permsData, roleData] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERMISSIONS),
        AdminApi.get(`${AdminConstants.ENDPOINTS.SYSTEM.ROLES}/${this.state.roleSlug}`)
      ]);

      if (!this.mounted) return;
      this.setState({ permissions: permsData || [] });
      if (roleData) {
        this.setState({
          formData: {
            slug: roleData.slug || '',
            name: roleData.name || '',
            description: roleData.description || '',
            type: roleData.type || 'custom',
            permissions: roleData.permissions || []
          },
        });
      }
    } catch (e) {
      console.error("Failed to load role data", e);
      notify('error', 'Load Failed', 'Could not retrieve role details.');
      this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST);
    } finally {
      if (this.mounted) this.setState({ fetching: false });
    }
  }

  private togglePermission(perm: string): void {
    this.setState((prev) => ({
      formData: {
        ...prev.formData,
        permissions: prev.formData.permissions.includes(perm)
          ? prev.formData.permissions.filter((p) => p !== perm)
          : [...prev.formData.permissions, perm]
      },
    }));
  }

  private updateForm(patch: Partial<EditRolePageState['formData']>): void {
    this.setState((prev) => ({ formData: { ...prev.formData, ...patch } }));
  }

  private async handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const notify = this.runtime.notify.notify;
    this.setState({ loading: true });
    try {
      await AdminApi.put(`${AdminConstants.ENDPOINTS.SYSTEM.ROLES}/${this.state.roleSlug}`, this.state.formData);
      notify('success', 'Role Updated', `${this.state.formData.name} has been synchronized.`);
      this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST);
    } catch (e: any) {
      console.error("Failed to update role", e);
      notify('error', 'Update Failed', e.message || "An error occurred while saving.");
    } finally {
      this.setState({ loading: false });
    }
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { fetching, loading, permissions, formData } = this.state;

    if (fetching) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label="Synchronizing Role Manifest..." />
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col animate-in fade-in duration-300">
        <CompactPageHeader
          theme={theme}
          onBack={() => this.router.back()}
          title={`Edit role: ${formData.name}`}
          subtitle="Modify permission sets and metadata."
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
                      onChange={(e) => this.updateForm({ name: e.target.value })}
                      required
                      size="sm"
                    />
                    <Input
                      label="Slug (System ID)"
                      placeholder="e.g. editor"
                      value={formData.slug}
                      disabled
                      size="sm"
                      className="opacity-50 grayscale"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-tight text-slate-400 pl-1">Description</label>
                    <textarea
                      className={`w-full h-24 rounded-lg p-3 border outline-none transition-colors text-sm font-medium ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
                      }`}
                      placeholder="Optional description of what this role allows..."
                      value={formData.description}
                      onChange={(e) => this.updateForm({ description: e.target.value })}
                    />
                  </div>
                </div>
              </Card>

              <EditRolePermissionsCard
                theme={theme}
                permissions={permissions}
                selected={formData.permissions}
                onToggle={(perm) => this.togglePermission(perm)}
              />
            </div>

            <EditRoleSummarySidebar
              type={formData.type}
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
