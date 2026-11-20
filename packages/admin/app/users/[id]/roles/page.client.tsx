import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactElement } from 'react';
import { prop, state, bound } from '@fromcode119/react-class-components';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Loader } from '@/components/ui/view/loader.client';
import { StatePage } from '@/components/ui/view/state-page.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { RoleChoices } from '@/app/users/components/view/role-choices.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import { PendingSavesBar } from '@/components/ui/view/pending-saves-bar.client';

export class UserRolesPage extends AdminComponent {
  private mounted = false;
  private pending: PendingSave | null = null;

  @prop declare params: Promise<{ id: string }>;

  @state routeId = '';
  @state user: any = null;
  @state roles: any[] = [];
  @state selectedRoles: string[] = [];
  @state loading = true;
  @state saving = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    this.pending = new PendingSave(() => this.selectedRoles, () => this.handleSave(), (values: string[]) => { this.selectedRoles = values; });
    const params = await this.params;
    if (!this.mounted) return;
    this.routeId = params.id;
    void this.fetchData();
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.pending?.dispose();
  }

  private async fetchData(): Promise<void> {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USERS),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.ROLES)
      ]);

      const foundUser = (usersRes.docs || []).find((u: any) => String(u.id) === String(this.routeId));
      if (foundUser && this.mounted) {
        this.user = foundUser;
        this.selectedRoles = foundUser.roles || [];
        this.pending?.mark();
      }

      if (this.mounted) this.roles = rolesRes || [];
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  /** Written by the page's save bar; the page stays on the account it saved. */
  @bound private async handleSave(): Promise<void> {
    this.saving = true;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USER_ROLES, {
        userId: this.routeId,
        roles: this.selectedRoles
      });
    } catch (err: any) {
      this.pending?.failed();
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('users.saveFailed'), err?.message || AdminI18n.t('users.failedToSaveRoles'));
    } finally {
      this.saving = false;
    }
  }

  @bound private toggleRole(slug: string): void {
    this.selectedRoles = this.selectedRoles.includes(slug)
      ? this.selectedRoles.filter((s) => s !== slug)
      : [...this.selectedRoles, slug];
  }

  render(): ReactElement {
    const theme = this.theme;
    const { user, roles, selectedRoles, loading, saving } = this;

    if (loading) return <Loader fullPage label={AdminI18n.t('users.loadingRoles')} />;
    if (!user) return <StatePage title={AdminI18n.t('users.userNotFound2')} />;

    return (
      <div className={`w-full flex flex-col ${AdminClass.of('settings-page')}`}>
        <CompactPageHeader
          theme={theme}
          backHref="/users"
          title={AdminI18n.t('users.manageRoles2')}
          subtitle={user.email}
        />
        <ListShell title={AdminI18n.t('users.rolesPermissions')} count={selectedRoles.length}>
          <RoleChoices roles={roles} selected={selectedRoles} onToggle={(slug: string) => this.toggleRole(slug)} disabled={saving} />
        </ListShell>
        <PendingSavesBar />
      </div>
    );
  }
}
