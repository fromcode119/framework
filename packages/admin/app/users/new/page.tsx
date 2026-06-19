"use client";

import React from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/admin-component';
import { NewUserHeader } from './new-user-header';
import { NewUserRolesCard } from './new-user-roles-card';
import { NewUserAccountFields } from './new-user-account-fields';
import { NewUserAccessControls } from './new-user-access-controls';
import type { NewUserFormData, NewUserPageState } from './new-user-page.interfaces';

export default class NewUserPage extends AdminComponent<Record<string, never>, NewUserPageState> {
  private mounted = false;

  state: NewUserPageState = {
    saving: false,
    loadingRoles: true,
    roles: [],
    formData: {
      email: '',
      username: '',
      firstName: '',
      lastName: '',
      accountStatus: 'active',
      forcePasswordReset: false,
      password: '',
      confirmPassword: '',
      roles: [],
    },
    errors: {},
  };

  componentDidMount(): void {
    this.mounted = true;
    void this.loadRoles();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async loadRoles(): Promise<void> {
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.ROLES);
      if (!this.mounted) return;
      this.setState({ roles: Array.isArray(response) ? response : [] });
    } catch (err) {
      if (!this.mounted) return;
      console.error('Failed to load roles:', err);
      this.setState((prev) => ({ errors: { ...prev.errors, roles: 'Failed to load roles' } }));
    } finally {
      if (this.mounted) this.setState({ loadingRoles: false });
    }
  }

  private patchForm(patch: Partial<NewUserFormData>): void {
    this.setState((prev) => ({ formData: { ...prev.formData, ...patch } }));
  }

  private toggleRole(slug: string): void {
    this.setState((prev) => ({
      formData: {
        ...prev.formData,
        roles: prev.formData.roles.includes(slug)
          ? prev.formData.roles.filter((role) => role !== slug)
          : [...prev.formData.roles, slug],
      },
    }));
  }

  private async handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    this.setState({ saving: true, errors: {} });

    const { formData } = this.state;

    if (!formData.password) {
      this.setState({ errors: { password: 'Password is required' }, saving: false });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      this.setState({ errors: { confirmPassword: 'Passwords do not match' }, saving: false });
      return;
    }

    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USERS, formData);
      this.router.push('/users');
    } catch (err: any) {
      console.error('Failed to create user:', err);
      this.setState({ errors: { global: err.message || 'Failed to create user' } });
    } finally {
      this.setState({ saving: false });
    }
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { saving, loadingRoles, roles, formData, errors } = this.state;
    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
        <NewUserHeader
          theme={theme}
          saving={saving}
          onCancel={() => this.router.back()}
          onSubmit={(e) => this.handleSubmit(e)}
        />

        <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-12">
           <form onSubmit={(e) => this.handleSubmit(e)} className="space-y-8">
              <NewUserAccountFields
                formData={formData}
                errors={errors}
                onPatch={(patch) => this.patchForm(patch)}
              />

              <NewUserRolesCard
                theme={theme}
                roles={roles}
                loadingRoles={loadingRoles}
                selectedRoles={formData.roles}
                rolesError={errors.roles}
                onToggleRole={(slug) => this.toggleRole(slug)}
              />

              <NewUserAccessControls
                formData={formData}
                onPatch={(patch) => this.patchForm(patch)}
              />

              {errors.global && (
                 <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-bold flex items-center gap-3 tracking-tight">
                    <FrameworkIcons.Warning size={18} />
                    {errors.global}
                 </div>
              )}
           </form>
        </div>
      </div>
    );
  }
}
