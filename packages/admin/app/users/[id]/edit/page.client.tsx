import type { FormEvent, ReactElement } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { EditUserHeader } from '@/app/users/[id]/edit/components/view/edit-user-header.client';
import { EditUserFormFields } from '@/app/users/[id]/edit/components/view/edit-user-form-fields.client';
import { prop, state } from '@fromcode119/reactor';
import type { IEditUserFormData } from '@/app/users/[id]/edit/interfaces/edit-user-form-data.interface';

export class EditUserPage extends AdminComponent {
  @prop declare params: Promise<{ id: string }>;

  @state routeId = '';
  @state loading = true;
  @state saving = false;
  @state formData: IEditUserFormData = {
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    accountStatus: 'active',
    forcePasswordReset: false,
    password: '',
    confirmPassword: ''
  };
  @state errors: Record<string, string> = {};

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.params;
    if (!this.mounted) return;
    this.routeId = params.id;
    void this.fetchUser();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchUser(): Promise<void> {
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USER(this.routeId));
      if (!this.mounted) return;
      this.formData = {
        email: data.email || '',
        username: data.username || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        accountStatus: String(data.accountStatus || 'active'),
        forcePasswordReset: Boolean(data.forcePasswordReset),
        password: '',
        confirmPassword: ''
      };
    } catch (err) {
      console.error('Failed to fetch user:', err);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private updateForm(patch: Partial<IEditUserFormData>): void {
    this.formData = { ...this.formData, ...patch };
  }

  private async handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    this.saving = true;
    this.errors = {};

    const formData = this.formData;
    const routeId = this.routeId;
    if (formData.password && formData.password !== formData.confirmPassword) {
      this.errors = { confirmPassword: 'Passwords do not match' };
      this.saving = false;
      return;
    }

    try {
      await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.USER(routeId), formData);
      this.router.push(AdminConstants.ROUTES.USERS.DETAIL(routeId));
    } catch (err: any) {
      console.error('Failed to update user:', err);
      this.errors = { global: err.message || 'Failed to update user' };
    } finally {
      this.saving = false;
    }
  }

  render(): ReactElement {
    const theme = this.theme;
    const id = this.routeId;
    const { loading, saving, formData, errors } = this;

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
                 <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-bold flex items-center gap-3">
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
