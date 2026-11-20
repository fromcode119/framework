import type { ReactElement } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { EditUserHeader } from '@/app/users/[id]/edit/components/view/edit-user-header.client';
import { EditUserFormFields } from '@/app/users/[id]/edit/components/view/edit-user-form-fields.client';
import { EditUserNotifications } from '@/app/users/[id]/edit/components/view/edit-user-notifications.client';
import { prop, state } from '@fromcode119/react-class-components';
import type { IEditUserFormData } from '@/app/users/[id]/edit/interfaces/edit-user-form-data.interface';
import { SelfAccount } from '@/lib/self-account';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AccountStatus } from '@/app/users/enums/account-status.enum';
import { Alert } from '@/components/ui/view/alert.client';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import { PendingSavesBar } from '@/components/ui/view/pending-saves-bar.client';

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
    accountStatus: AccountStatus.ACTIVE.value,
    forcePasswordReset: false,
    password: '',
    confirmPassword: ''
  };
  @state errors: Record<string, string> = {};
  /** The API's word that this member's sign-in account is not this site's to change. */
  @state identityLocked = false;

  private mounted = false;
  private pending: PendingSave | null = null;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    this.pending = new PendingSave(() => this.formData, () => this.save(), (values: IEditUserFormData) => { this.formData = values; this.errors = {}; });
    const params = await this.params;
    if (!this.mounted) return;
    this.routeId = params.id;
    void this.fetchUser();
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.pending?.dispose();
  }

  /** Your own account without `users:manage` — see {@link SelfAccount}. */
  private get selfService(): boolean {
    return SelfAccount.isSelfService(this.auth?.user, this.routeId, 'users:manage');
  }

  private async fetchUser(): Promise<void> {
    try {
      const data = this.selfService
        ? (await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.SECURITY))?.user
        : await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USER(this.routeId));
      if (!this.mounted) return;
      this.identityLocked = Boolean(data.identityLocked);
      this.formData = {
        email: data.email || '',
        username: data.username || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        accountStatus: AccountStatus.resolve(data.accountStatus).value,
        forcePasswordReset: Boolean(data.forcePasswordReset),
        password: '',
        confirmPassword: ''
      };
      this.pending?.mark();
    } catch (err) {
      console.error('Failed to fetch user:', err);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private updateForm(patch: Partial<IEditUserFormData>): void {
    this.formData = { ...this.formData, ...patch };
  }

  /** Written by the page's save bar. A refusal keeps the edits unsaved and says why beside the field. */
  private async save(): Promise<void> {
    this.saving = true;
    this.errors = {};

    const formData = this.formData;
    const routeId = this.routeId;
    if (formData.password && formData.password !== formData.confirmPassword) {
      this.errors = { confirmPassword: AdminI18n.t('users.passwordsDoNotMatch') };
      this.saving = false;
      this.pending?.failed();
      return;
    }

    if (this.selfService && formData.password && !formData.currentPassword) {
      this.errors = { currentPassword: AdminI18n.t('users.enterYourCurrentPasswordTo') };
      this.saving = false;
      this.pending?.failed();
      return;
    }

    try {
      if (this.selfService) {
        await AdminApi.patch(AdminConstants.ENDPOINTS.AUTH.PROFILE, { firstName: formData.firstName, lastName: formData.lastName });
        if (formData.password) {
          await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.CHANGE_PASSWORD, { currentPassword: formData.currentPassword, newPassword: formData.password });
        }
      } else {
        await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.USER(routeId), formData);
      }
      // A password is entered once: after it is stored the fields empty, and what stays on screen is saved.
      this.formData = { ...this.formData, password: '', confirmPassword: '', currentPassword: '' };
    } catch (err: any) {
      console.error('Failed to update user:', err);
      this.pending?.failed();
      this.errors = { global: err.message || AdminI18n.t('users.failedToUpdateUser') };
    } finally {
      this.saving = false;
    }
  }

  render(): ReactElement {
    const theme = this.theme;
    const id = this.routeId;
    const { loading, formData, errors } = this;

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader label={AdminI18n.t('users.synchronizingIdentityDetails')} />
        </div>
      );
    }

    return (
      <div className={`w-full flex flex-col animate-in fade-in duration-500 ${AdminClass.of('settings-page')}`}>
        <EditUserHeader theme={theme} userId={id} />

        <div className="w-full py-6">
           <div className="fc-stack">
              <EditUserFormFields
                formData={formData}
                errors={errors}
                onPatch={(patch) => this.updateForm(patch)}
                selfService={this.selfService}
                identityLocked={this.identityLocked}
              />

              {errors.global ? <Alert tone="danger">{errors.global}</Alert> : null}
           </div>

           {/* Your own switches act for the session; for someone else an administrator sets theirs through
               the admin route, which checks the account belongs to this site. */}
           <div className="mt-6"><EditUserNotifications userId={SelfAccount.isOwn(this.auth?.user, id) ? undefined : id} /></div>
        </div>
        <PendingSavesBar />
      </div>
    );
  }
}
