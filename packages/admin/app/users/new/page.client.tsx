import type { FormEvent, ReactElement } from 'react';
import { state, bound } from '@fromcode119/reactor';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { NewUserHeader } from '@/app/users/new/components/view/new-user-header.client';
import { NewUserRolesCard } from '@/app/users/new/components/view/new-user-roles-card.client';
import { NewUserAccountFields } from '@/app/users/new/components/view/new-user-account-fields.client';
import { NewUserAccessControls } from '@/app/users/new/components/view/new-user-access-controls.client';
import type { INewUserFormData } from '@/app/users/new/interfaces/new-user-form-data.interface';

export class NewUserPage extends AdminComponent {
  private mounted = false;

  @state saving = false;
  @state loadingRoles = true;
  @state roles: any[] = [];
  @state formData: INewUserFormData = {
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    accountStatus: 'active',
    forcePasswordReset: false,
    password: '',
    confirmPassword: '',
    roles: [],
  };
  @state errors: Record<string, string> = {};

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
      this.roles = Array.isArray(response) ? response : [];
    } catch (err) {
      if (!this.mounted) return;
      console.error('Failed to load roles:', err);
      this.errors = { ...this.errors, roles: 'Failed to load roles' };
    } finally {
      if (this.mounted) this.loadingRoles = false;
    }
  }

  @bound private patchForm(patch: Partial<INewUserFormData>): void {
    this.formData = { ...this.formData, ...patch };
  }

  @bound private toggleRole(slug: string): void {
    this.formData = {
      ...this.formData,
      roles: this.formData.roles.includes(slug)
        ? this.formData.roles.filter((role) => role !== slug)
        : [...this.formData.roles, slug],
    };
  }

  @bound private handleCancel(): void {
    this.router.back();
  }

  @bound private async handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    this.saving = true;
    this.errors = {};

    const { formData } = this;

    if (!formData.password) {
      this.errors = { password: 'Password is required' };
      this.saving = false;
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      this.errors = { confirmPassword: 'Passwords do not match' };
      this.saving = false;
      return;
    }

    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USERS, formData);
      this.router.push('/users');
    } catch (err: any) {
      console.error('Failed to create user:', err);
      this.errors = { global: err.message || 'Failed to create user' };
    } finally {
      this.saving = false;
    }
  }

  render(): ReactElement {
    const theme = this.theme;
    const { saving, loadingRoles, roles, formData, errors } = this;
    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
        <NewUserHeader
          theme={theme}
          saving={saving}
          onCancel={this.handleCancel}
          onSubmit={this.handleSubmit}
        />

        <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-12">
           <form onSubmit={this.handleSubmit} className="space-y-8">
              <NewUserAccountFields
                formData={formData}
                errors={errors}
                onPatch={this.patchForm}
              />

              <NewUserRolesCard
                theme={theme}
                roles={roles}
                loadingRoles={loadingRoles}
                selectedRoles={formData.roles}
                rolesError={errors.roles}
                onToggleRole={this.toggleRole}
              />

              <NewUserAccessControls
                formData={formData}
                onPatch={this.patchForm}
              />

              {errors.global && (
                 <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-bold flex items-center gap-3 tracking-tight">
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
