import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Loader } from '@/components/ui/view/loader.client';
import { Alert } from '@/components/ui/view/alert.client';
import { RoleChoices } from '@/app/users/components/view/role-choices.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class NewUserRolesCard extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare roles: any[];
  @prop declare loadingRoles: boolean;
  @prop declare selectedRoles: string[];
  @prop declare rolesError?: string;
  @prop declare onToggleRole: (slug: string) => void;

  render(): ReactNode {
    const { roles, loadingRoles, selectedRoles, rolesError, onToggleRole } = this;
    return (
      <ListShell title={AdminI18n.t('users.rolesPermissions')} count={selectedRoles.length} subtitle={AdminI18n.t('users.permissionsAreInheritedFromRoles')}>
        {loadingRoles ? (
          <div className="fc-list-band"><Loader label={AdminI18n.t('users.loadingRoles2')} /></div>
        ) : roles.length === 0 ? (
          <EmptyState title={AdminI18n.t('users.noRolesAvailableCreateRoles')} />
        ) : (
          <RoleChoices roles={roles} selected={selectedRoles} onToggle={onToggleRole} />
        )}
        {rolesError ? <div className="fc-list-band"><Alert tone="danger">{rolesError}</Alert></div> : null}
      </ListShell>
    );
  }
}
