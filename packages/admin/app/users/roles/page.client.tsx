import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactElement } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminPageFooter } from '@/components/ui/view/admin-page-footer.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { RolesListCard } from '@/app/users/roles/components/view/roles-list-card.client';
import { RolesAuditSidebar } from '@/app/users/roles/components/view/roles-audit-sidebar.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class RolesPage extends AdminComponent {
  private mounted = false;

  @state roles: any[] = [];
  @state logs: any[] = [];
  @state health: any = null;
  @state loading = true;
  @state showDeleteConfirm = false;
  @state roleToDelete: any = null;
  @state isDeleting = false;

  componentDidMount(): void {
    this.mounted = true;
    void this.fetchData();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchData(): Promise<void> {
    try {
      if (this.mounted) this.loading = true;
      const [rolesRes, logsRes, healthRes] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.ROLES),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.LOGS),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.HEALTH),
      ]);
      const logs = Array.isArray(logsRes?.docs) ? logsRes.docs : Array.isArray(logsRes) ? logsRes : [];
      if (this.mounted) {
        this.roles = rolesRes || [];
        this.logs = logs;
        this.health = healthRes || null;
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  @bound
  requestDelete(role: any): void {
    this.roleToDelete = role;
    this.showDeleteConfirm = true;
  }

  @bound
  closeDelete(): void {
    this.showDeleteConfirm = false;
  }

  @bound
  async handleDelete(): Promise<void> {
    const roleToDelete = this.roleToDelete;
    const notify = this.runtime.notify.notify;
    if (!roleToDelete) return;
    this.isDeleting = true;
    try {
      await AdminApi.delete(`${AdminConstants.ENDPOINTS.SYSTEM.ROLES}/${roleToDelete.slug}`);
      notify(NotificationType.SUCCESS, AdminI18n.t('users.roleDeleted'), AdminI18n.t('users.hasBeenRemoved', { name: roleToDelete.name }));
      await this.fetchData();
      this.showDeleteConfirm = false;
    } catch (err: any) {
      notify(NotificationType.ERROR, AdminI18n.t('users.deletionFailed'), err.message);
    } finally {
      this.isDeleting = false;
    }
  }

  render(): ReactElement {
    const theme = this.theme;
    const { roles, logs, health, loading, showDeleteConfirm, roleToDelete, isDeleting } = this;

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label={AdminI18n.t('users.hydratingSecurityMatrix')} />
        </div>
      );
    }

    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-300">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Shield size={18} strokeWidth={2} />}
          title={AdminI18n.t('users.roles')}
          subtitle={AdminI18n.t('users.manageUserRolesAndSecurity')}
          actions={
            <Link href={AdminConstants.ROUTES.USERS.ROLE_NEW}>
              <Button className="px-4 h-9 rounded-lg font-semibold text-xs text-white" icon={<FrameworkIcons.Plus size={15} strokeWidth={2} />}>
                {AdminI18n.t('users.createRole')}
              </Button>
            </Link>
          }
        />

        <div className="flex-1 w-full px-6 lg:px-8 py-6">
          <div className="space-y-6 pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-12 xl:col-span-8 space-y-6">
                <RolesListCard
                  roles={roles}
                  theme={theme}
                  onRequestDelete={this.requestDelete}
                />
              </div>

              <RolesAuditSidebar logs={logs} health={health} loading={loading} theme={theme} />
            </div>
          </div>
        </div>

        <AdminPageFooter
          label={AdminI18n.t('users.rolesManagement')}
          description={AdminI18n.t('users.manageAndCustomizeSystemAccess')}
          links={[
            { label: AdminI18n.t('users.users'), href: AdminConstants.ROUTES.USERS.LIST },
            { label: AdminI18n.t('users.permissions'), href: AdminConstants.ROUTES.USERS.PERMISSIONS },
            { label: AdminI18n.t('users.activityLog'), href: AdminConstants.ROUTES.ACTIVITY },
          ]}
        />

        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={this.closeDelete}
          onConfirm={this.handleDelete}
          isLoading={isDeleting}
          title={AdminI18n.t('users.deleteRole')}
          description={AdminI18n.t('users.areYouSureYouWant', { name: roleToDelete?.name })}
          confirmLabel={AdminI18n.t('users.destroyRole')}
        />
      </div>
    );
  }
}
