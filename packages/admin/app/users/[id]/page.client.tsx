import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactElement, ReactNode } from 'react';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { UserProfileHeader } from '@/app/users/[id]/components/view/user-profile-header.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { AdminClass } from '@/lib/admin-class';
import { AccountStatus } from '@/app/users/enums/account-status.enum';
import { UserOwnershipCard } from '@/app/users/[id]/components/view/user-ownership-card.client';
import { prop, state, bound } from '@fromcode119/react-class-components';
import { SelfAccount } from '@/lib/self-account';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class UserProfilePage extends AdminComponent {
  @prop declare params: Promise<{ id: string }>;

  @state routeId = '';
  @state user: any = null;
  @state loading = true;
  /** role slug → the name the operator gave it under Roles. */
  @state roleNames: Record<string, string> = {};

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

  /** After a transfer both accounts changed, so the page re-reads rather than guessing the new state. */
  @bound private reload(): void {
    void this.fetchUser();
  }

  /** Your own account, viewed without `users:view` — see {@link SelfAccount}. */
  private get selfService(): boolean {
    return SelfAccount.isSelfService(this.auth?.user, this.routeId, 'users:view');
  }

  private async fetchUser(): Promise<void> {
    try {
      const data = this.selfService ? await this.fetchOwnAccount() : await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USER(this.routeId));
      if (this.mounted) this.user = data;
      if (!this.selfService) {
        // The operator's names for the roles; the record carries only their slugs.
        const roles = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.ROLES).catch(() => []);
        if (this.mounted) this.roleNames = Object.fromEntries((Array.isArray(roles) ? roles : []).map((role: any) => [String(role?.slug ?? ''), String(role?.name ?? '').trim()]).filter(([slug, name]) => slug && name));
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  /** The same record, from the account's own endpoint. */
  private async fetchOwnAccount(): Promise<any> {
    const state = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.SECURITY);
    return { ...state?.user, accountStatus: state?.account?.status, forcePasswordReset: Boolean(state?.account?.forcePasswordReset) };
  }

  render(): ReactElement {
    const theme = this.theme;
    const id = this.routeId;
    const selfService = this.selfService;
    const user = this.user;
    const loading = this.loading;

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader label={AdminI18n.t('users.synchronizingIdentity')} />
        </div>
      );
    }

    if (!user) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
          <h1 className="text-2xl font-medium text-slate-400 tracking-tight">{AdminI18n.t('users.userNotFound')}</h1>
          <AdminLink href={AdminConstants.ROUTES.USERS.LIST}>
            <Button variant={ButtonVariant.GHOST}>{AdminI18n.t('users.returnToDatabase')}</Button>
          </AdminLink>
        </div>
      );
    }

    const initials = user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user.email[0].toUpperCase();

    const pill = AdminClass.of('ext-pill');
    const suspended = AccountStatus.resolve(user.accountStatus) === AccountStatus.SUSPENDED;
    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
    const value = (text: ReactNode) => <span className={AdminClass.of('settings-value')}>{text}</span>;
    const notSet = <span className={`${AdminClass.of('settings-value')} ${AdminClass.of('settings-value--empty')}`}>{AdminI18n.t('users.notSet')}</span>;

    return (
      <div className={`w-full flex flex-col animate-in fade-in duration-500 ${AdminClass.of('settings-page')}`}>
        <UserProfileHeader theme={theme} user={user} userId={id} initials={initials} selfService={selfService} />

        <div className="w-full py-6 fc-page-stack">
          <Card title={AdminI18n.t('users.accountInformation')}>
            <SettingRow title={AdminI18n.t('users.firstName')} width={SettingRowWidth.AUTO}>{user.firstName ? value(user.firstName) : notSet}</SettingRow>
            <SettingRow title={AdminI18n.t('users.lastName')} width={SettingRowWidth.AUTO}>{user.lastName ? value(user.lastName) : notSet}</SettingRow>
            <SettingRow title={AdminI18n.t('users.eMailAddress')} width={SettingRowWidth.AUTO}>{value(user.email)}</SettingRow>
            <SettingRow title={AdminI18n.t('users.username')} width={SettingRowWidth.AUTO}>{user.username ? value(user.username) : notSet}</SettingRow>
          </Card>

          <Card title={AdminI18n.t('users.assignedSecurityRoles')}>
            <SettingRow title={AdminI18n.t('users.roles')} width={SettingRowWidth.AUTO}>
              {roles.length
                ? roles.map((role) => <span key={role} className={pill}>{this.roleNames[role] || role}</span>)
                : <span className={`${AdminClass.of('settings-value')} ${AdminClass.of('settings-value--empty')}`}>{AdminI18n.t('users.noRolesAssignedToThis')}</span>}
              {selfService ? null : (
                <AdminLink href={AdminConstants.ROUTES.USERS.ROLES(id)}>
                  <Button variant={ButtonVariant.SECONDARY}>{AdminI18n.t('users.manageAssignments')}</Button>
                </AdminLink>
              )}
            </SettingRow>
          </Card>

          <Card title={AdminI18n.t('users.systemMetadata')}>
            <SettingRow title={AdminI18n.t('users.accountStatus')} width={SettingRowWidth.AUTO}>
              <span className={`${pill} ${AdminClass.of(suspended ? 'ext-pill--danger' : 'ext-pill--ok')}`}>{suspended ? AdminI18n.t('users.suspended') : AdminI18n.t('users.active')}</span>
            </SettingRow>
            <SettingRow title={AdminI18n.t('users.passwordReset')} width={SettingRowWidth.AUTO}>
              {value(user.forcePasswordReset ? AdminI18n.t('users.requiredOnNextLogin') : AdminI18n.t('users.notRequired'))}
            </SettingRow>
            {/* Only when known: the account's own endpoint does not carry the dates. */}
            {user.createdAt ? <SettingRow title={AdminI18n.t('users.created')} width={SettingRowWidth.AUTO}>{value(new Date(user.createdAt).toLocaleDateString())}</SettingRow> : null}
            {user.updatedAt ? <SettingRow title={AdminI18n.t('users.lastModified')} width={SettingRowWidth.AUTO}>{value(new Date(user.updatedAt).toLocaleDateString())}</SettingRow> : null}
          </Card>

          {selfService ? null : <UserOwnershipCard user={user} onTransferred={this.reload} />}
        </div>
      </div>
    );
  }
}
