"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/loader';
import { AdminComponent } from '@/components/admin-component';
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
                  Edit Role: {formData.name}
                </h1>
                <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
                  Modify existing permission sets and metadata.
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
                      onChange={(e) => this.updateForm({ name: e.target.value })}
                      required
                    />
                    <Input
                      label="Slug (System ID)"
                      placeholder="e.g. editor"
                      value={formData.slug}
                      disabled
                      className="opacity-50 grayscale"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-tight text-slate-400 pl-1">Description</label>
                    <textarea
                      className={`w-full h-32 rounded-3xl p-6 border outline-none transition-all text-sm font-bold ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
                      }`}
                      placeholder="Optional description of what this role allows..."
                      value={formData.description}
                      onChange={(e) => this.updateForm({ description: e.target.value })}
                    />
                  </div>
                </div>
              </Card>

              <Card title="Permissions">
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Available Options</span>
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">{formData.permissions.length} Selected</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {permissions.map(perm => (
                      <div
                        key={perm.name}
                        onClick={() => this.togglePermission(perm.name)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 flex items-center justify-between group ${
                          formData.permissions.includes(perm.name)
                            ? (theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-indigo-50 border-indigo-200')
                            : (theme === 'dark' ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200')
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs font-bold tracking-tight ${formData.permissions.includes(perm.name) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                            {perm.name}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight opacity-60">
                            {perm.group || 'General'}
                          </span>
                        </div>
                        <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                           formData.permissions.includes(perm.name)
                             ? 'bg-indigo-500 border-indigo-500 text-white'
                             : 'bg-transparent border-slate-200 dark:border-slate-800'
                        }`}>
                           {formData.permissions.includes(perm.name) && <FrameworkIcons.Check size={12} strokeWidth={4} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <Card title="Summary">
                <div className="space-y-6">
                  <div className="bg-indigo-500/5 rounded-2.5xl p-6 border border-indigo-500/10 space-y-4">
                     <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Role Type</span>
                        <Badge variant="amber">{formData.type}</Badge>
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Selected Scope</span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {formData.permissions.length === 0 ? 'No permissions' : `${formData.permissions.length} actions selected`}
                        </span>
                     </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 text-[11px] font-bold uppercase tracking-tight rounded-xl shadow-lg shadow-indigo-600/10 text-white"
                    isLoading={loading}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full h-11 font-bold text-slate-400"
                    onClick={() => this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST)}
                  >
                    Cancel
                  </Button>
                </div>
              </Card>

              <Card title="Security Note">
                 <p className="text-xs text-slate-500 font-bold leading-relaxed italic">
                   Changes to role permissions are applied immediately. Users currently logged in with this role may need to refresh their session to see changes.
                 </p>
              </Card>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
