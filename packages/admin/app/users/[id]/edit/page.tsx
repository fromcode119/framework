"use client";

import React from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/loader';
import { AdminComponent } from '@/components/admin-component';
import { EditUserHeader } from './edit-user-header';
import { EditUserFormFields } from './edit-user-form-fields';
import type { EditUserPageProps, EditUserPageState } from './edit-user-page.interfaces';

export default class EditUserPage extends AdminComponent<EditUserPageProps, EditUserPageState> {
  private mounted = false;

  state: EditUserPageState = {
    routeId: '',
    loading: true,
    saving: false,
    formData: {
      email: '',
      username: '',
      firstName: '',
      lastName: '',
      accountStatus: 'active',
      forcePasswordReset: false,
      password: '',
      confirmPassword: ''
    },
    errors: {},
  };

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.props.params;
    if (!this.mounted) return;
    this.setState({ routeId: params.id }, () => void this.fetchUser());
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchUser(): Promise<void> {
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USER(this.state.routeId));
      if (!this.mounted) return;
      this.setState({
        formData: {
          email: data.email || '',
          username: data.username || '',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          accountStatus: String(data.accountStatus || 'active'),
          forcePasswordReset: Boolean(data.forcePasswordReset),
          password: '',
          confirmPassword: ''
        },
      });
    } catch (err) {
      console.error('Failed to fetch user:', err);
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private updateForm(patch: Partial<EditUserPageState['formData']>): void {
    this.setState((prev) => ({ formData: { ...prev.formData, ...patch } }));
  }

  private async handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    this.setState({ saving: true, errors: {} });

    const { formData, routeId } = this.state;
    if (formData.password && formData.password !== formData.confirmPassword) {
      this.setState({ errors: { confirmPassword: 'Passwords do not match' }, saving: false });
      return;
    }

    try {
      await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.USER(routeId), formData);
      this.router.push(AdminConstants.ROUTES.USERS.DETAIL(routeId));
    } catch (err: any) {
      console.error('Failed to update user:', err);
      this.setState({ errors: { global: err.message || 'Failed to update user' } });
    } finally {
      this.setState({ saving: false });
    }
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { routeId: id, loading, saving, formData, errors } = this.state;

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label="Synchronizing Identity Details..." />
        </div>
      );
    }

    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
        <EditUserHeader
          theme={theme}
          userId={id}
          saving={saving}
          onCancel={() => this.router.back()}
          onSubmit={(e) => this.handleSubmit(e)}
        />

        <div className="flex-1 w-full max-w-4xl mx-auto px-6 lg:px-8 py-6">
           <form onSubmit={(e) => this.handleSubmit(e)} className="space-y-6">
              <EditUserFormFields
                formData={formData}
                errors={errors}
                onPatch={(patch) => this.updateForm(patch)}
              />

              {errors.global && (
                 <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-bold flex items-center gap-3">
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
